from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response

from .models import BorrowRecord, License, LicenseRenewal
from .serializers import (
    BorrowRecordSerializer,
    LicenseRenewalSerializer,
    LicenseSerializer,
    RenewalActionSerializer,
)
from .services import (
    approve_renewal,
    complete_renewal,
    dashboard_stats,
    refresh_borrow_status,
    refresh_license_status,
    reject_renewal,
    start_renewal_process,
    submit_renewal,
    validate_renewal_creation,
)


class LicenseViewSet(viewsets.ModelViewSet):
    serializer_class = LicenseSerializer

    def get_queryset(self):
        queryset = License.objects.filter(is_current_version=True)
        search = self.request.query_params.get("search")
        filter_status = self.request.query_params.get("status")
        license_type = self.request.query_params.get("type")
        include_history = self.request.query_params.get("include_history") == "true"

        if include_history:
            queryset = License.objects.all()

        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(license_no__icontains=search)
                | Q(issuing_authority__icontains=search)
                | Q(owner_department__icontains=search)
            )
        if filter_status:
            queryset = queryset.filter(status=filter_status)
        if license_type:
            queryset = queryset.filter(license_type=license_type)
        return queryset

    def get_object(self):
        if self.action in ("history", "renewals"):
            queryset = License.objects.all()
        else:
            queryset = self.filter_queryset(self.get_queryset())
        lookup_url_kwarg = self.lookup_url_kwarg or self.lookup_field
        filter_kwargs = {self.lookup_field: self.kwargs[lookup_url_kwarg]}
        obj = get_object_or_404(queryset, **filter_kwargs)
        self.check_object_permissions(self.request, obj)
        return obj

    def perform_create(self, serializer):
        license_obj = serializer.save()
        refresh_license_status(license_obj)

    def perform_update(self, serializer):
        license_obj = serializer.save()
        refresh_license_status(license_obj)

    @action(detail=True, methods=["get"], url_path="history")
    def history(self, request, pk=None):
        license_obj = self.get_object()
        original_id = license_obj.original_license_id or license_obj.id
        history = License.objects.filter(
            Q(id=original_id) | Q(original_license_id=original_id)
        ).order_by("version")
        serializer = self.get_serializer(history, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["get"], url_path="renewals")
    def renewals(self, request, pk=None):
        license_obj = self.get_object()
        renewals = license_obj.renewals.all()
        serializer = LicenseRenewalSerializer(renewals, many=True)
        return Response(serializer.data)


class BorrowRecordViewSet(viewsets.ModelViewSet):
    serializer_class = BorrowRecordSerializer

    def get_queryset(self):
        queryset = BorrowRecord.objects.select_related("license")
        filter_status = self.request.query_params.get("status")
        license_id = self.request.query_params.get("license")
        if filter_status:
            queryset = queryset.filter(status=filter_status)
        if license_id:
            queryset = queryset.filter(license_id=license_id)
        return queryset

    def perform_create(self, serializer):
        record = serializer.save()
        refresh_borrow_status(record)

    def perform_update(self, serializer):
        record = serializer.save()
        refresh_borrow_status(record)


class LicenseRenewalViewSet(viewsets.ModelViewSet):
    serializer_class = LicenseRenewalSerializer

    def get_queryset(self):
        queryset = LicenseRenewal.objects.select_related("license", "new_license")
        filter_status = self.request.query_params.get("status")
        license_id = self.request.query_params.get("license")
        if filter_status:
            queryset = queryset.filter(status=filter_status)
        if license_id:
            queryset = queryset.filter(license_id=license_id)
        return queryset

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        license_obj = serializer.validated_data.get("license")
        if license_obj:
            try:
                validate_renewal_creation(license_obj)
            except ValueError as e:
                return Response(
                    {"detail": str(e)},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        self.perform_create(serializer)
        headers = self.get_success_headers(serializer.data)
        return Response(
            serializer.data,
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def perform_create(self, serializer):
        serializer.save()

    @action(detail=True, methods=["post"], url_path="submit")
    def submit(self, request, pk=None):
        renewal = self.get_object()
        if renewal.status != LicenseRenewal.Status.PENDING:
            return Response(
                {"detail": "只有待提交的申请才能提交审核"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        renewal = submit_renewal(renewal)
        serializer = self.get_serializer(renewal)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        renewal = self.get_object()
        if renewal.status != LicenseRenewal.Status.REVIEWING:
            return Response(
                {"detail": "只有审核中的申请才能批准"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = RenewalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reviewer = serializer.validated_data.get("reviewer", "")
        comments = serializer.validated_data.get("review_comments", "")
        if not reviewer:
            return Response(
                {"detail": "审核人不能为空"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        renewal = approve_renewal(renewal, reviewer, comments)
        return Response(self.get_serializer(renewal).data)

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        renewal = self.get_object()
        if renewal.status != LicenseRenewal.Status.REVIEWING:
            return Response(
                {"detail": "只有审核中的申请才能拒绝"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = RenewalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        reviewer = serializer.validated_data.get("reviewer", "")
        comments = serializer.validated_data.get("review_comments", "")
        if not reviewer:
            return Response(
                {"detail": "审核人不能为空"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        renewal = reject_renewal(renewal, reviewer, comments)
        return Response(self.get_serializer(renewal).data)

    @action(detail=True, methods=["post"], url_path="start")
    def start_process(self, request, pk=None):
        renewal = self.get_object()
        try:
            renewal = start_renewal_process(renewal)
            return Response(self.get_serializer(renewal).data)
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=["post"], url_path="complete")
    def complete(self, request, pk=None):
        renewal = self.get_object()
        serializer = RenewalActionSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        new_issue_date = serializer.validated_data.get("new_issue_date")
        new_expiry_date = serializer.validated_data.get("new_expiry_date")
        new_license_no = serializer.validated_data.get("new_license_no") or None
        notes = serializer.validated_data.get("notes", "")
        if not new_issue_date or not new_expiry_date:
            return Response(
                {"detail": "新发证日期和新到期日期不能为空"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            renewal, new_license = complete_renewal(
                renewal, new_issue_date, new_expiry_date, new_license_no
            )
            if notes:
                renewal.notes = notes
                renewal.save(update_fields=["notes"])
            return Response(
                {
                    "renewal": self.get_serializer(renewal).data,
                    "new_license": LicenseSerializer(new_license).data,
                }
            )
        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


@api_view(["GET"])
def stats_view(_request):
    stats = dashboard_stats()
    return Response(
        {
            **{key: value for key, value in stats.items() if key not in {"upcoming_expiries", "expired"}},
            "upcoming_expiries": LicenseSerializer(stats["upcoming_expiries"], many=True).data,
            "expired": LicenseSerializer(stats["expired"], many=True).data,
        }
    )

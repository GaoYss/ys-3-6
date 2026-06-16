from rest_framework import serializers

from .models import BorrowRecord, License, LicenseRenewal


class LicenseSerializer(serializers.ModelSerializer):
    days_until_expiry = serializers.IntegerField(read_only=True)
    computed_status = serializers.CharField(read_only=True)
    license_type_display = serializers.CharField(source="get_license_type_display", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    has_active_renewal = serializers.BooleanField(read_only=True)
    active_renewal_status = serializers.SerializerMethodField()

    class Meta:
        model = License
        fields = [
            "id",
            "name",
            "license_no",
            "license_type",
            "license_type_display",
            "issuing_authority",
            "owner_department",
            "keeper",
            "issue_date",
            "expiry_date",
            "reminder_days",
            "status",
            "status_display",
            "computed_status",
            "days_until_expiry",
            "notes",
            "original_license",
            "version",
            "is_current_version",
            "has_active_renewal",
            "active_renewal_status",
            "created_at",
            "updated_at",
        ]

    def get_active_renewal_status(self, obj):
        active = obj.active_renewal
        if active:
            return {
                "id": active.id,
                "status": active.status,
                "status_display": active.get_status_display(),
            }
        return None


class BorrowRecordSerializer(serializers.ModelSerializer):
    license_name = serializers.CharField(source="license.name", read_only=True)
    computed_status = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)

    class Meta:
        model = BorrowRecord
        fields = [
            "id",
            "license",
            "license_name",
            "borrower",
            "borrower_department",
            "purpose",
            "borrow_date",
            "expected_return_date",
            "actual_return_date",
            "status",
            "status_display",
            "computed_status",
            "notes",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        borrow_date = attrs.get("borrow_date", getattr(self.instance, "borrow_date", None))
        expected_return_date = attrs.get("expected_return_date", getattr(self.instance, "expected_return_date", None))
        actual_return_date = attrs.get("actual_return_date", getattr(self.instance, "actual_return_date", None))

        if expected_return_date and borrow_date and expected_return_date < borrow_date:
            raise serializers.ValidationError({"expected_return_date": "预计归还日期不能早于借出日期"})
        if actual_return_date and borrow_date and actual_return_date < borrow_date:
            raise serializers.ValidationError({"actual_return_date": "实际归还日期不能早于借出日期"})
        return attrs


class LicenseRenewalSerializer(serializers.ModelSerializer):
    license_name = serializers.CharField(source="license.name", read_only=True)
    license_no = serializers.CharField(source="license.license_no", read_only=True)
    license_expiry_date = serializers.DateField(source="license.expiry_date", read_only=True)
    status_display = serializers.CharField(source="get_status_display", read_only=True)
    new_license_id = serializers.IntegerField(source="new_license.id", read_only=True, allow_null=True)

    class Meta:
        model = LicenseRenewal
        fields = [
            "id",
            "license",
            "license_name",
            "license_no",
            "license_expiry_date",
            "applicant",
            "applicant_department",
            "apply_date",
            "reason",
            "new_issue_date",
            "new_expiry_date",
            "new_license_no",
            "status",
            "status_display",
            "reviewer",
            "review_date",
            "review_comments",
            "completed_date",
            "new_license",
            "new_license_id",
            "notes",
            "created_at",
            "updated_at",
        ]

    def validate(self, attrs):
        new_issue_date = attrs.get("new_issue_date")
        new_expiry_date = attrs.get("new_expiry_date")
        if new_issue_date and new_expiry_date and new_expiry_date <= new_issue_date:
            raise serializers.ValidationError({"new_expiry_date": "新到期日期必须晚于新发证日期"})
        return attrs


class RenewalActionSerializer(serializers.Serializer):
    reviewer = serializers.CharField(max_length=60, required=False)
    review_comments = serializers.CharField(required=False, allow_blank=True)
    new_issue_date = serializers.DateField(required=False)
    new_expiry_date = serializers.DateField(required=False)
    new_license_no = serializers.CharField(max_length=80, required=False, allow_blank=True)
    notes = serializers.CharField(required=False, allow_blank=True)

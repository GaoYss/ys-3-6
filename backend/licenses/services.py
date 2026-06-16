from django.db.models import Count
from django.utils import timezone

from .models import BorrowRecord, License, LicenseRenewal


def refresh_license_status(license_obj):
    computed_status = license_obj.computed_status
    if license_obj.status != computed_status:
        license_obj.status = computed_status
        license_obj.save(update_fields=["status", "updated_at"])
    return license_obj


def refresh_borrow_status(record):
    computed_status = record.computed_status
    if record.status != computed_status:
        record.status = computed_status
        record.save(update_fields=["status", "updated_at"])
    return record


def dashboard_stats():
    today = timezone.localdate()
    licenses = list(License.objects.filter(is_current_version=True))
    for license_obj in licenses:
        refresh_license_status(license_obj)

    borrow_records = list(BorrowRecord.objects.filter(status__in=[BorrowRecord.Status.BORROWED, BorrowRecord.Status.OVERDUE]))
    for record in borrow_records:
        refresh_borrow_status(record)

    status_counts = dict(
        License.objects.filter(is_current_version=True)
        .values_list("status")
        .annotate(total=Count("id"))
    )
    type_counts = dict(
        License.objects.filter(is_current_version=True)
        .values_list("license_type")
        .annotate(total=Count("id"))
    )

    active_renewal_count = LicenseRenewal.objects.filter(
        status__in=[
            LicenseRenewal.Status.PENDING,
            LicenseRenewal.Status.REVIEWING,
            LicenseRenewal.Status.APPROVED,
            LicenseRenewal.Status.IN_PROGRESS,
        ]
    ).count()

    return {
        "total_licenses": License.objects.filter(is_current_version=True).count(),
        "active_licenses": status_counts.get(License.Status.ACTIVE, 0),
        "expiring_licenses": status_counts.get(License.Status.EXPIRING, 0),
        "expired_licenses": status_counts.get(License.Status.EXPIRED, 0),
        "borrowed_records": BorrowRecord.objects.filter(status=BorrowRecord.Status.BORROWED).count(),
        "overdue_returns": BorrowRecord.objects.filter(status=BorrowRecord.Status.OVERDUE).count(),
        "by_type": type_counts,
        "upcoming_expiries": License.objects.filter(
            is_current_version=True, expiry_date__gte=today
        ).order_by("expiry_date")[:8],
        "expired": License.objects.filter(
            is_current_version=True, expiry_date__lt=today
        ).order_by("expiry_date")[:8],
        "active_renewals": active_renewal_count,
    }


def submit_renewal(renewal):
    renewal.status = LicenseRenewal.Status.REVIEWING
    renewal.save(update_fields=["status", "updated_at"])
    return renewal


def approve_renewal(renewal, reviewer, review_comments=""):
    renewal.status = LicenseRenewal.Status.APPROVED
    renewal.reviewer = reviewer
    renewal.review_date = timezone.localdate()
    renewal.review_comments = review_comments
    renewal.save(
        update_fields=[
            "status",
            "reviewer",
            "review_date",
            "review_comments",
            "updated_at",
        ]
    )
    return renewal


def reject_renewal(renewal, reviewer, review_comments=""):
    renewal.status = LicenseRenewal.Status.REJECTED
    renewal.reviewer = reviewer
    renewal.review_date = timezone.localdate()
    renewal.review_comments = review_comments
    renewal.save(
        update_fields=[
            "status",
            "reviewer",
            "review_date",
            "review_comments",
            "updated_at",
        ]
    )
    return renewal


def start_renewal_process(renewal):
    if renewal.status != LicenseRenewal.Status.APPROVED:
        raise ValueError("只有已批准的续期申请才能进入续期流程")
    renewal.status = LicenseRenewal.Status.IN_PROGRESS
    renewal.save(update_fields=["status", "updated_at"])
    return renewal


def complete_renewal(renewal, new_issue_date, new_expiry_date, new_license_no=None):
    if renewal.status not in [LicenseRenewal.Status.APPROVED, LicenseRenewal.Status.IN_PROGRESS]:
        raise ValueError("只有已批准或续期中的申请才能完成")
    if not new_issue_date or not new_expiry_date:
        raise ValueError("新发证日期和新到期日期不能为空")
    if new_expiry_date <= new_issue_date:
        raise ValueError("新到期日期必须晚于新发证日期")

    old_license = renewal.license

    original_license_id = old_license.original_license_id or old_license.id

    new_license = License.objects.create(
        name=old_license.name,
        license_no=new_license_no or old_license.license_no,
        license_type=old_license.license_type,
        issuing_authority=old_license.issuing_authority,
        owner_department=old_license.owner_department,
        keeper=old_license.keeper,
        issue_date=new_issue_date,
        expiry_date=new_expiry_date,
        reminder_days=old_license.reminder_days,
        status=License.Status.ACTIVE,
        notes=old_license.notes,
        original_license_id=original_license_id,
        version=old_license.version + 1,
        is_current_version=True,
    )

    old_license.is_current_version = False
    old_license.status = License.Status.ARCHIVED
    old_license.save(update_fields=["is_current_version", "status", "updated_at"])

    renewal.new_issue_date = new_issue_date
    renewal.new_expiry_date = new_expiry_date
    if new_license_no:
        renewal.new_license_no = new_license_no
    renewal.new_license = new_license
    renewal.status = LicenseRenewal.Status.COMPLETED
    renewal.completed_date = timezone.localdate()
    renewal.save(
        update_fields=[
            "new_issue_date",
            "new_expiry_date",
            "new_license_no",
            "new_license",
            "status",
            "completed_date",
            "updated_at",
        ]
    )

    refresh_license_status(new_license)

    return renewal, new_license

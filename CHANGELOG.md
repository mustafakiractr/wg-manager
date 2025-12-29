# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed - 2025-12-29

#### Transaction Management Bug Fix
- **Critical Fix**: Fixed peer template deletion issue caused by improper transaction management
- **Root Cause**: Service layer was committing transactions independently, conflicting with FastAPI's dependency injection pattern
- **Solution**:
  - Removed all `await db.commit()` calls from service layer
  - Implemented `await db.flush()` for intermediate operations
  - Centralized transaction management in `get_db()` dependency
  - Now all database operations are atomic (all succeed or all rollback)

#### Files Changed:
- `backend/app/services/peer_template_service.py`
  - `create_template()`: Changed commit to flush
  - `update_template()`: Changed commit to flush
  - `delete_template()`: Removed commit (handled by dependency)
  - `toggle_active()`: Changed commit to flush
  - `increment_usage()`: Removed commit
- `backend/app/services/activity_log_service.py`
  - `log_activity()`: Changed commit to flush, removed manual rollback

#### Benefits:
- ✅ Peer template deletion now works correctly
- ✅ Activity logging failures properly rollback the entire transaction
- ✅ Database consistency guaranteed
- ✅ Follows FastAPI best practices for transaction management

### Documentation
- Updated README.md with correct GitHub repository URL
- Added CHANGELOG.md to track project changes

---

## [Previous Releases]

### [1.0.0] - 2024-12-XX

#### Added
- Initial release
- WireGuard interface and peer management
- MikroTik RouterOS v7+ integration
- IP Pool management with automatic allocation
- Peer template system
- Real-time dashboard and analytics
- Activity logging and audit trail
- Notification system
- QR code generation for mobile clients
- JWT authentication
- Dark mode support
- Multi-language support (Turkish)

#### Security
- JWT-based authentication
- Role-based access control
- Rate limiting
- Bcrypt password hashing
- CORS protection

---

[Unreleased]: https://github.com/mustafakiractr/wg-manager/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mustafakiractr/wg-manager/releases/tag/v1.0.0

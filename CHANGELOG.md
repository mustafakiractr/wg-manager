# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added - 2025-12-29

#### Automated Dependency Installation
- **Enhanced install.sh**: Now automatically installs Python 3.9+, Node.js 20+, npm, and all system dependencies
- **Auto-Detection**: Detects and installs missing dependencies on Ubuntu, Debian, CentOS, and RHEL
- **Version Management**: Automatically upgrades outdated Python and Node.js versions
- **One-Command Setup**: Complete automation with `quick-start.sh`

#### Installation Features:
- Automatic Python 3.11 installation (Ubuntu/Debian) or Python 3.9 (CentOS/RHEL)
- Automatic Node.js 20.x LTS installation via NodeSource repositories
- Automatic installation of build tools and development libraries
- Platform-specific package management (apt/yum)
- Smart dependency checking and version validation
- Automatic virtual environment creation
- Automatic npm package installation

#### Benefits:
- ✅ Zero manual dependency installation required
- ✅ Works on fresh Linux installations
- ✅ Detects and upgrades outdated dependencies
- ✅ Multi-platform support (Ubuntu, Debian, CentOS, RHEL)
- ✅ Production-ready systemd service creation
- ✅ Comprehensive error handling and user feedback

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

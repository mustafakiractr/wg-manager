# 🔒 WireGuard Manager Panel

Modern web-based management interface for MikroTik RouterOS v7+ WireGuard VPN.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Python 3.9+](https://img.shields.io/badge/python-3.9+-blue.svg)](https://www.python.org/)
[![Node.js 18+](https://img.shields.io/badge/node-18+-green.svg)](https://nodejs.org/)

---

## ✨ Features

- 🔐 **WireGuard Management** - Create, edit, delete interfaces and peers
- 📊 **Dashboard & Analytics** - Real-time traffic statistics and monitoring
- 🔔 **Notification System** - Real-time alerts and notifications
- 📝 **Activity Logging** - Complete audit trail of all operations
- 🎯 **IP Pool Management** - Automatic IP allocation with templates
- 📱 **QR Code Generation** - Easy mobile device configuration
- 🎨 **Modern UI** - Dark mode, responsive design, intuitive interface
- 🔒 **Secure** - JWT authentication, role-based access control, rate limiting

---

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- Node.js 18+
- MikroTik RouterOS v7+
- 1GB RAM, 1GB disk space

### Installation

```bash
# Clone the repository
git clone https://github.com/mustafakiractr/wg-manager.git /opt/wg-manager
cd /opt/wg-manager

# Run installation script
sudo bash install.sh

# Configure environment
bash setup_environment.sh

# Start services
bash start_all.sh
```

### Access the Application

```
URL: http://localhost:5173
Username: admin
Password: admin123
```

⚠️ **Change the default password immediately after first login!**

---

## 📖 Documentation

For comprehensive documentation, please refer to:

- **[PROJECT_GUIDE.md](PROJECT_GUIDE.md)** - Complete guide with installation, configuration, API docs, and troubleshooting
- **[Backend API Documentation](#)** - Available at `/docs` endpoint when running
- **[Archived Documentation](archive/docs/)** - Historical docs and specific guides

---

## 🏗️ Tech Stack

**Backend:**
- FastAPI (Python 3.9+)
- SQLAlchemy (async ORM)
- PostgreSQL / SQLite
- JWT Authentication

**Frontend:**
- React 18 + Vite
- Tailwind CSS
- Zustand (state management)
- React Router v6

**Infrastructure:**
- MikroTik RouterOS API
- WebSocket (real-time updates)
- Systemd services

---

## 📁 Project Structure

```
wg-manager/
├── backend/              # FastAPI application
│   ├── app/
│   │   ├── api/         # API endpoints
│   │   ├── models/      # Database models
│   │   ├── services/    # Business logic
│   │   └── main.py      # Application entry
│   └── requirements.txt
│
├── frontend/            # React application
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── pages/       # Page components
│   │   └── App.jsx
│   └── package.json
│
├── archive/             # Archived documentation
├── systemd/             # Service configurations
├── README.md           # This file
└── PROJECT_GUIDE.md    # Complete documentation
```

---

## 🔧 Development

### Backend

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Security

- JWT-based authentication
- Role-based access control (RBAC)
- Rate limiting on sensitive endpoints
- Activity logging and audit trail
- Bcrypt password hashing
- CORS protection
- HTTPS support

For security best practices, see [PROJECT_GUIDE.md](PROJECT_GUIDE.md#security).

---

## 📊 Screenshots

### Dashboard
Real-time monitoring of WireGuard interfaces, peers, and traffic statistics.

### WireGuard Management
Easy interface and peer management with QR code generation.

### Activity Logs
Complete audit trail of all system operations.

---

## 🛠️ Production Deployment

### Systemd Services

**Backend Service:**
```bash
# Enable and start backend
sudo systemctl enable router-manager-backend
sudo systemctl start router-manager-backend
sudo systemctl status router-manager-backend
```

**Frontend Service:**
```bash
# Install serve for static file serving
npm install -g serve

# Enable and start frontend
sudo systemctl enable router-manager-frontend
sudo systemctl start router-manager-frontend
sudo systemctl status router-manager-frontend
```

**Access the application:**
- Frontend: http://your-server:5173
- Backend API: http://your-server:8000
- API Docs: http://your-server:8000/docs

For complete deployment guide, see [PROJECT_GUIDE.md](PROJECT_GUIDE.md#deployment).

---

## 🐛 Troubleshooting

### Common Issues

**Backend won't start:**
```bash
cd backend
source venv/bin/activate
pip install -r requirements.txt
```

**MikroTik connection failed:**
```bash
# Check MikroTik API service
/ip service print
/ip service set api disabled=no
```

**Frontend CORS errors:**
```bash
# Check CORS_ORIGINS in backend/.env
CORS_ORIGINS=["http://localhost:5173"]
```

For more troubleshooting help, see [PROJECT_GUIDE.md](PROJECT_GUIDE.md#troubleshooting).

---

## 📝 API Documentation

Interactive API documentation is available when the backend is running:

- **Swagger UI:** http://localhost:8000/docs
- **ReDoc:** http://localhost:8000/redoc

For detailed API documentation, see [PROJECT_GUIDE.md](PROJECT_GUIDE.md#api-documentation).

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- [MikroTik](https://mikrotik.com/) - RouterOS and API
- [WireGuard](https://www.wireguard.com/) - Fast, modern VPN protocol
- [FastAPI](https://fastapi.tiangolo.com/) - Modern Python web framework
- [React](https://react.dev/) - UI library

---

## 📞 Support

For issues and questions:
- 📋 [GitHub Issues](https://github.com/mustafakiractr/wg-manager/issues)
- 📖 Documentation: [PROJECT_GUIDE.md](PROJECT_GUIDE.md)

---

**Made with ❤️ using FastAPI and React**

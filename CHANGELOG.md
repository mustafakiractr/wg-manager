# Changelog

Tüm önemli değişiklikler bu dosyada belgelenecektir.

## [Yayınlanmamış] - 2025-01-07

### Düzeltildi
- **Kullanıcı Silme Sorunu**: User model'inde cascade delete ayarları eklendi
  - Session relationship'e `cascade="all, delete-orphan"` eklendi
  - Session model'ine `back_populates="sessions"` eklendi
  - ActivityLog foreign key'e `ondelete="SET NULL"` eklendi (loglar korunur)
  - Kullanıcı silindiğinde ilişkili notifications ve sessions otomatik silinir

- **Toplu Peer İşlemleri Sorunu**: Backend bulk endpoint'leri entegre edildi
  - Frontend'de `bulkEnablePeers()`, `bulkDisablePeers()`, `bulkDeletePeers()` metodları eklendi
  - WireGuardInterfaceDetail.jsx'de toplu işlemler optimize edildi
  - For loop yerine tek API call ile toplu işlem yapılıyor
  - Performans iyileştirmesi: 10 peer için 10 API call → 1 API call

### Teknik Detaylar
- Backend: `/wg/peers/bulk/enable`, `/wg/peers/bulk/disable`, `/wg/peers/bulk/delete` endpoint'leri aktif
- Frontend: wireguardService.js'e 3 yeni metod eklendi
- Database: User model'e cascade delete mekanizması eklendi

---

## [1.0.0] - 2025-01-06

### Eklendi
- WireGuard interface ve peer yönetimi
- Dashboard ve analytics
- IP Pool yönetimi
- Peer Templates
- Bildirim sistemi
- Aktivite geçmişi
- 2FA desteği
- Email bildirimleri
- Telegram entegrasyonu

### İyileştirildi
- Backup size görüntüleme hatası düzeltildi
- Hard-coded path'ler portable hale getirildi
- Nginx production configuration eklendi
- Deploy automation script'i eklendi
- Docker test environment oluşturuldu

### Dokümantasyon
- 8 MD dosyası → 3 MD dosyasına konsolide edildi
- README.md sadeleştirildi (340 → 80 satır)
- DOCUMENTATION.md oluşturuldu (360+ satır)
- Nginx kurulum kılavuzu eklendi
- Production deployment rehberi eklendi

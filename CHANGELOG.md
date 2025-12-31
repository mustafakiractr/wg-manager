# Değişiklik Geçmişi

Bu dosya projedeki tüm önemli değişiklikleri içerir.

Format [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) standardına uyar,
ve proje [Semantic Versioning](https://semver.org/spec/v2.0.0.html) kurallarını takip eder.

## [Yayınlanmamış]

### Eklenenler - 2025-12-29

#### Otomatik Bağımlılık Kurulumu
- **Geliştirilmiş install.sh**: Python 3.9+, Node.js 20+, npm ve tüm sistem bağımlılıklarını otomatik yükler
- **Otomatik Algılama**: Ubuntu, Debian, CentOS ve RHEL'de eksik bağımlılıkları tespit eder ve yükler
- **Versiyon Yönetimi**: Eski Python ve Node.js sürümlerini otomatik yükseltir
- **Tek Komut Kurulum**: `quick-start.sh` ile tam otomasyon

#### Kurulum Özellikleri:
- Otomatik Python 3.11 kurulumu (Ubuntu/Debian) veya Python 3.9 (CentOS/RHEL)
- NodeSource repository'leri üzerinden otomatik Node.js 20.x LTS kurulumu
- Build araçları ve geliştirme kütüphanelerinin otomatik kurulumu
- Platforma özgü paket yönetimi (apt/yum)
- Akıllı bağımlılık kontrolü ve versiyon doğrulama
- Otomatik sanal ortam oluşturma
- Otomatik npm paket kurulumu

#### Faydalar:
- ✅ Manuel bağımlılık kurulumu gerektirmez
- ✅ Yeni Linux kurulumlarında çalışır
- ✅ Eski bağımlılıkları tespit eder ve yükseltir
- ✅ Çoklu platform desteği (Ubuntu, Debian, CentOS, RHEL)
- ✅ Production-ready systemd servisi oluşturma
- ✅ Kapsamlı hata yönetimi ve kullanıcı geri bildirimi

### Düzeltmeler - 2025-12-29

#### Transaction Yönetimi Hata Düzeltmesi
- **Kritik Düzeltme**: Yanlış transaction yönetiminden kaynaklanan peer template silme sorunu düzeltildi
- **Kök Neden**: Servis katmanı transaction'ları bağımsız commit ediyordu, FastAPI dependency injection pattern'i ile çakışıyordu
- **Çözüm**:
  - Servis katmanından tüm `await db.commit()` çağrıları kaldırıldı
  - Ara işlemler için `await db.flush()` uygulandı
  - Transaction yönetimi `get_db()` dependency'sinde merkezileştirildi
  - Artık tüm veritabanı işlemleri atomik (hepsi başarılı veya hepsi rollback)

#### Değişen Dosyalar:
- `backend/app/services/peer_template_service.py`
  - `create_template()`: commit, flush olarak değiştirildi
  - `update_template()`: commit, flush olarak değiştirildi
  - `delete_template()`: commit kaldırıldı (dependency tarafından yönetiliyor)
  - `toggle_active()`: commit, flush olarak değiştirildi
  - `increment_usage()`: commit kaldırıldı
- `backend/app/services/activity_log_service.py`
  - `log_activity()`: commit, flush olarak değiştirildi, manuel rollback kaldırıldı

#### Faydalar:
- ✅ Peer template silme işlemi artık doğru çalışıyor
- ✅ Aktivite loglama hataları tüm transaction'ı düzgünce rollback ediyor
- ✅ Veritabanı tutarlılığı garanti ediliyor
- ✅ FastAPI best practice'lerine uygun transaction yönetimi

### Dokümantasyon
- README.md doğru GitHub repository URL'si ile güncellendi
- Proje değişikliklerini takip için CHANGELOG.md eklendi

---

## [Önceki Sürümler]

### [1.0.0] - 2024-12-XX

#### Eklenenler
- İlk sürüm
- WireGuard arayüz ve peer yönetimi
- MikroTik RouterOS v7+ entegrasyonu
- Otomatik IP tahsisi ile IP Havuzu yönetimi
- Peer şablon sistemi
- Gerçek zamanlı panel ve analitik
- Aktivite loglama ve denetim kaydı
- Bildirim sistemi
- Mobil cihazlar için QR kod oluşturma
- JWT kimlik doğrulama
- Karanlık mod desteği
- Çoklu dil desteği (Türkçe)

#### Güvenlik
- JWT tabanlı kimlik doğrulama
- Rol tabanlı erişim kontrolü
- Hız sınırlama
- Bcrypt şifre hashleme
- CORS koruması

---

[Yayınlanmamış]: https://github.com/mustafakiractr/wg-manager/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/mustafakiractr/wg-manager/releases/tag/v1.0.0

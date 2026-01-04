# Telegram Bildirim Sistemi - Kullanım Kılavuzu

## 📱 Telegram Bot Oluşturma

### Adım 1: Bot Oluştur

1. Telegram uygulamasını açın
2. `@BotFather` botunu arayın ve sohbeti başlatın
3. `/newbot` komutunu gönderin
4. Bot'unuz için bir isim girin (örn: "WireGuard Manager")
5. Bot'unuz için bir kullanıcı adı girin (örn: "my_wg_manager_bot")
   - Kullanıcı adı `bot` ile bitmelidir
6. BotFather size bir **Bot Token** verecektir:
   ```
   1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
   ```
   **⚠️ Bu token'ı güvenli bir yerde saklayın!**

### Adım 2: Chat ID Öğrenme

#### Yöntem 1: Bireysel Kullanıcı (Önerilen)

1. Oluşturduğunuz bot'a mesaj gönderin (örn: `/start`)
2. Aşağıdaki URL'yi tarayıcınızda açın (bot token'ınızı değiştirin):
   ```
   https://api.telegram.org/bot<BOT_TOKEN>/getUpdates
   ```
3. JSON yanıtında `"chat":{"id":123456789}` alanını bulun
4. Bu ID'yi **Chat ID** olarak kullanın

#### Yöntem 2: @userinfobot Kullanarak

1. Telegram'da `@userinfobot` botunu bulun
2. Bot'a herhangi bir mesaj gönderin
3. Bot size `ID` bilginizi verecektir
4. Bu ID'yi **Chat ID** olarak kullanın

#### Yöntem 3: Grup/Kanal (İsteğe Bağlı)

1. Bot'unuzu bir gruba veya kanala ekleyin
2. Bot'u yönetici yapın
3. Gruba/kanala bir mesaj gönderin
4. `getUpdates` URL'sini kullanarak grup/kanal ID'sini bulun
5. Grup ID'leri genellikle negatif sayılardır (örn: `-1001234567890`)

---

## ⚙️ Yapılandırma

### Web Arayüzünden Yapılandırma

1. **Ayarlar** sayfasına gidin
2. **Bildirimler** sekmesine tıklayın
3. Aşağıdaki bilgileri girin:
   - **Bot Token**: BotFather'dan aldığınız token
   - **Chat ID**: Öğrendiğiniz Chat ID (kullanıcı veya grup)
4. **Bildirim Kategorilerini** seçin:
   - 🔴 **Peer Bağlantısı Kesildi**: WireGuard peer offline olduğunda
   - 🟢 **Peer Bağlantısı Kuruldu**: WireGuard peer tekrar online olduğunda
   - ⚠️ **MikroTik Bağlantısı Kesildi**: Router bağlantısı koptuğunda
   - 💾 **Yedekleme Başarısız**: Backup işlemi hata verdiğinde
   - 🔒 **Başarısız Giriş Denemesi**: Hesap kilitlendiğinde
   - ❌ **Sistem Hatası**: Kritik sistem hatalarında
5. **Aktif/Pasif** anahtarını açın
6. **Test Mesajı Gönder** butonuna tıklayarak yapılandırmayı test edin
7. **Kaydet** butonuna tıklayın

---

## 📬 Bildirim Formatı

### Örnek Bildirim Mesajları

#### Peer Bağlantısı Kesildi
```
🔴 Peer Bağlantısı Kesildi

📝 client-mobile bağlantısı kesildi

Interface: wg0
Peer ID: *10
Last Handshake: 2m 15s

🕐 03.01.2025 11:45:23
```

#### MikroTik Bağlantısı Kesildi
```
⚠️ MikroTik Bağlantısı Kesildi

📝 Router bağlantısı kesildi

Host: 192.168.1.1:8728
Hata: Connection timeout

🕐 03.01.2025 11:45:23
```

#### Yedekleme Başarısız
```
💾 Yedekleme Başarısız

📝 WireGuard yapılandırması yedeklenemedi

Kullanıcı: admin
Hata: Permission denied

🕐 03.01.2025 11:45:23
```

---

## 🧪 Test ve Sorun Giderme

### Test Mesajı Gönderme

1. Ayarlar > Bildirimler sayfasında **Test Mesajı Gönder** butonuna tıklayın
2. Telegram uygulamanızı kontrol edin
3. Test mesajını aldıysanız, yapılandırma başarılıdır! ✅

### Yaygın Sorunlar

#### ❌ "Bot token geçersiz" Hatası
- Bot token'ınızı kontrol edin
- BotFather'dan yeni bir bot oluşturun
- Token'da boşluk veya ekstra karakter olmadığından emin olun

#### ❌ "Chat not found" Hatası
- Chat ID'yi kontrol edin
- Bot'a en az bir mesaj gönderdiğinizden emin olun
- Grup kullanıyorsanız, bot'un grupta olduğunu ve yönetici olduğunu kontrol edin

#### ❌ "Forbidden: bot was blocked by the user"
- Bot'u engellemeyi kaldırın
- Bot'a `/start` komutu gönderin

#### ❌ Bildirim Gelmiyor
- Ayarlar > Bildirimler sayfasında **Aktif** olduğundan emin olun
- İlgili kategorinin seçili olduğunu kontrol edin
- Backend loglarını kontrol edin:
  ```bash
  tail -f /root/wg/backend/logs/app.log | grep -i telegram
  ```

---

## 🔒 Güvenlik Notları

1. **Bot Token'ınızı paylaşmayın!** Bu token ile bot'unuzu kontrol edebilirler
2. Bot token sızarsa, BotFather üzerinden token'ı yenileyin
3. Chat ID bir güvenlik riski değildir, ancak yine de özel tutun
4. Bot'unuzu sadece güvenilir kişilerin bulunduğu gruplara ekleyin
5. Web arayüzünde bot token'ınız maskelenmiş olarak gösterilir (ilk 10 karakter + "...")

---

## 📊 İstatistikler

Ayarlar > Bildirimler sayfasında:
- **Toplam test mesajı sayısı** görülebilir
- Her kategori için bildirim geçmişi (ileride eklenecek)

---

## 🛠️ Gelişmiş Kullanım

### Birden Fazla Chat ID

Gelecek sürümlerde birden fazla chat ID'ye bildirim gönderme desteği eklenecektir.

### Sessiz Saatler

Gelecek sürümlerde belirli saatler arasında bildirim göndermeyi durdurma özelliği eklenecektir.

### Özel Mesaj Şablonları

Gelecek sürümlerde özelleştirilebilir mesaj şablonları eklenecektir.

---

## 📞 Destek

Sorun yaşarsanız:
1. Backend loglarını kontrol edin
2. Telegram Bot API yanıtlarını inceleyin
3. Sistem yöneticisine başvurun

---

**Son Güncelleme:** 3 Ocak 2025

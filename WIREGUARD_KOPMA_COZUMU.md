# WireGuard Anlık Kopma Sorunu Çözümü

## Sorun
WireGuard client ile bilgisayardan bağlandığında anlık kopmalar meydana geliyor ve hemen tekrar bağlanıyor.

## Neden
NAT (Network Address Translation) arkasındaki client'lar için WireGuard'da **persistent-keepalive** ayarı çok önemlidir. Bu ayar olmadan:

1. **NAT timeout**: NAT cihazları (router, firewall) kullanılmayan bağlantıları belirli bir süre sonra kapatır (genellikle 30-60 saniye)
2. **Handshake timeout**: WireGuard handshake paketleri NAT üzerinden geçemezse bağlantı kopar
3. **Bağlantı kopması**: Client bağlantıyı kaybeder ve yeniden handshake yapması gerekir

## Çözüm

### 1. Persistent Keepalive Ayarı
Backend'de peer eklenirken eğer `persistent-keepalive` belirtilmemişse **varsayılan olarak 25 saniye** eklenir.

**Neden 25 saniye?**
- WireGuard önerisi: 20-30 saniye arası
- NAT timeout'ları genellikle 30-60 saniye
- 25 saniye güvenli bir değer (NAT timeout'tan önce paket gönderir)

### 2. Mevcut Peer'ları Güncelleme
Eğer mevcut peer'larda kopma sorunu varsa:

1. **Dashboard'dan peer'ı düzenle**
2. **Persistent Keepalive** alanına `25s` veya `25` yaz
3. **Kaydet**

Veya MikroTik RouterOS'tan direkt:
```bash
/interface/wireguard/peers/set [find public-key="PEER_PUBLIC_KEY"] persistent-keepalive=25s
```

### 3. Frontend'den Manuel Ayarlama
Peer eklerken veya düzenlerken **Persistent Keepalive** alanına:
- `25s` (25 saniye - önerilen)
- `20s` (20 saniye - daha sık paket)
- `30s` (30 saniye - daha az paket)

değerlerinden birini girebilirsiniz.

## Teknik Detaylar

### Backend Değişiklikleri
`backend/app/api/wireguard.py` dosyasında:

```python
# Persistent keepalive ayarı - NAT arkasındaki client'lar için çok önemli
# Eğer belirtilmemişse varsayılan olarak 25 saniye ekle
if peer_data.persistent_keepalive:
    kwargs["persistent-keepalive"] = peer_data.persistent_keepalive
else:
    # Varsayılan persistent-keepalive: 25 saniye
    kwargs["persistent-keepalive"] = "25s"
```

### Nasıl Çalışır?
1. **Client → Server**: Her 25 saniyede bir keepalive paketi gönderir
2. **NAT güncelleme**: NAT tablosu güncellenir, bağlantı aktif kalır
3. **Handshake**: Normal handshake paketleri de geçer
4. **Stabil bağlantı**: Bağlantı kopmaz

## Test Etme

1. **Yeni peer ekle**: Persistent keepalive belirtmeden ekle
2. **Kontrol et**: MikroTik'te peer'ın `persistent-keepalive=25s` olduğunu doğrula
3. **Client'tan bağlan**: Kopma olmadan bağlanmalı
4. **Log kontrol**: Dashboard'da offline olayları artmamalı

## Ek Notlar

- **25 saniye** çoğu durum için yeterlidir
- **Daha sık paket** (20s) gerekiyorsa: Daha fazla bandwidth kullanır ama daha stabil
- **Daha az paket** (30s): Daha az bandwidth ama bazı NAT'larda sorun olabilir
- **Mobil bağlantılar**: Genellikle 25s yeterlidir
- **Sabit IP**: Persistent keepalive gerekli değildir ama zarar vermez

## Önemli Not: Persistent Keepalive vs Handshake

**Persistent Keepalive** ve **Handshake** farklı şeylerdir:

- **Persistent Keepalive (25s)**: NAT'ı günceller, her 25 saniyede bir gönderilir
- **Handshake**: WireGuard'ın gerçek bağlantı kontrolü, daha seyrek gelebilir
- **Handshake gecikmeleri normaldir**, özellikle NAT arkasındaki client'larda

Bu nedenle backend'de handshake timeout değeri **90 saniye** olarak ayarlanmıştır:
- 35 saniye çok kısaydı ve normal handshake gecikmelerini yanlış offline yapıyordu
- 90 saniye güvenli bir değer - gerçek kopmaları yakalar ama normal gecikmeleri yanlış offline yapmaz

## Sorun Devam Ederse

1. **MikroTik firewall kurallarını kontrol et**: WireGuard portu açık mı?
2. **NAT ayarlarını kontrol et**: Router'da port forwarding var mı?
3. **Client log'larını kontrol et**: WireGuard client log'larında hata var mı?
4. **MTU değerini kontrol et**: MTU çok büyükse paket parçalanabilir
5. **Handshake timeout**: Backend'de 90 saniye olarak ayarlanmıştır, bu normaldir
6. **MikroTik handshake timeout**: MikroTik'te interface'in handshake timeout değerini kontrol et


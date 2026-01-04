# 🧹 GitHub Repository Temizlik Kontrol Listesi

## ✅ Yapılması Gerekenler

### 1. GitHub Web Interface'de Kontrol Edilecekler

#### Branches
- [ ] `main` branch güncel mi kontrol et
- [ ] Gereksiz branch'ler var mı? (merge edilmiş olanları sil)
- [ ] Eski feature branch'ler temizlendi mi?

#### Releases
- [ ] Yeni release oluştur: `v1.5.0 - Telegram Integration`
- [ ] Release notes ekle (CHANGELOG'dan kopyala)
- [ ] Tag oluştur: `v1.5.0`

#### Issues
- [ ] Kapalı issue'ları kontrol et
- [ ] Gereksiz/spam issue'ları sil
- [ ] Açık issue'ları önceliklendir

#### Pull Requests
- [ ] Merge edilmiş PR'ları kontrol et
- [ ] Kapalı PR'ları temizle
- [ ] Draft PR'ları güncelle veya kapat

#### Wiki (varsa)
- [ ] Güncel dokümantasyon var mı?
- [ ] Gereksiz sayfalar temizle
- [ ] Yeni özellikler için dokümantasyon ekle

#### Settings
- [ ] Repository description güncel mi?
- [ ] Topics/Tags eklenmiş mi? (wireguard, mikrotik, fastapi, react)
- [ ] README badges güncel mi?
- [ ] Branch protection rules doğru mu?

### 2. README Güncellemeleri

- [ ] Telegram özelliği README'ye eklendi mi?
- [ ] Kurulum talimatları güncel mi?
- [ ] Screenshot'lar güncel mi?
- [ ] Badge'ler çalışıyor mu?
- [ ] License bilgisi doğru mu?

### 3. Gereksiz Dosyaları GitHub'dan Kaldırma

GitHub web interface'den şunları kontrol et:
- [ ] Eski/gereksiz dosyalar var mı?
- [ ] Duplicate dosyalar var mı?
- [ ] Test dosyaları production branch'inde mi?

### 4. Actions/Workflows (varsa)

- [ ] CI/CD pipeline'lar çalışıyor mu?
- [ ] Gereksiz workflow'lar var mı?
- [ ] Secrets güncel mi?

### 5. Security

- [ ] Dependabot alerts kontrol et
- [ ] Security advisories kontrol et
- [ ] `.env` dosyaları commit edilmemiş mi? (history'de de olmamalı)

---

## 🚀 GitHub'dan Manuel Temizlik Komutları

### Eski Branch'leri Silme
```bash
# Local branch'leri listele
git branch -a

# Remote'ta olmayan local branch'leri temizle
git remote prune origin

# Specific branch sil (local)
git branch -d branch-name

# Specific branch sil (remote)
git push origin --delete branch-name
```

### Git History Temizliği (Hassas!)
 **Dikkat:** History temizliği force push gerektirir!

```bash
# Büyük dosyaları history'den kaldırma (BFG Repo-Cleaner)
# https://rtyley.github.io/bfg-repo-cleaner/

# .env dosyalarını history'den kaldırma
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch *.env" \
  --prune-empty --tag-name-filter cat -- --all
```

### GitHub Storage Temizliği
```bash
# Git garbage collection
git gc --aggressive --prune=now

# Unreachable objects'leri temizle
git reflog expire --expire=now --all
git gc --prune=now
```

---

## 📊 Kontrol Sonuçları

- **Son Kontrol Tarihi:** 4 Ocak 2026
- **Commit Hash:** b014d89
- **Branch Durumu:** ✅ main güncel
- **Toplam Dosya:** 150+
- **Repository Boyutu:** ~60 MB

---

## 🔗 Faydalı Linkler

- Repository: https://github.com/mustafakiractr/wg-manager
- Issues: https://github.com/mustafakiractr/wg-manager/issues
- Releases: https://github.com/mustafakiractr/wg-manager/releases
- Wiki: https://github.com/mustafakiractr/wg-manager/wiki

---

**Not:** Bu kontrol listesini GitHub web interface'de manuel olarak takip edin.

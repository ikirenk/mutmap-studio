<div align="center">

[English](README.md) | **Türkçe**

# MutMap Studio

**Yapay Zeka Destekli Mutasyon Ayrıştırma ve Akademik Yayın Kalitesinde Gen/Protein Haritalama Masaüstü Uygulaması**

[![Windows Kurulum İndir](https://img.shields.io/badge/Windows-Kurulum%20(.exe)-0078D6?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/ikirenk/mutmap-studio/releases/latest)
[![Windows Taşınabilir İndir](https://img.shields.io/badge/Windows-Portable%20(.zip)-00A4EF?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/ikirenk/mutmap-studio/releases/latest)
[![macOS İndir](https://img.shields.io/badge/macOS-Universal%20(.dmg)-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/ikirenk/mutmap-studio/releases/latest)
[![Linux İndir](https://img.shields.io/badge/Linux-AppImage%20%2F%20deb-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/ikirenk/mutmap-studio/releases/latest)

</div>

> **Not:** Farklı bir GitHub depo adı kullanıyorsanız yukarıdaki indirme düğmelerindeki `ikirenk/mutmap-studio` kısmını kendi depo adresinizle güncelleyebilirsiniz.

---

**MutMap Studio**, bilimsel makalelerden kopyalanıp yapıştırılan ham mutasyon tablolarını yapay zeka ile yapılandırılmış JSON formatına çeviren ve iki farklı akademik yayın kalitesinde saf SVG grafik modunda çizen, standalone çalışabilen bir masaüstü biyoinformatik uygulamasıdır (**Electron + React + TypeScript + D3.js / Saf SVG**).

---

## Temel Özellikler

### 1. Yapay Zeka Destekli Mutasyon Tablosu Ayrıştırıcı
- **Satır Kaymalı PDF / Makale Metni Desteği:** Tablo başlıklarını otomatik algılar, bölünmüş satır devamlarını birleştirir, uzun tabloları token limitine takılmadan örtüşen parçalara (chunking) böler ve sınır tekrarlarını tekilleştirir.
- **Çoklu Yapay Zeka Sağlayıcısı:**
  - **Google Gemini** (`gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.0-flash`) — katı `responseSchema` desteği
  - **OpenAI** (`gpt-4o-mini`, `gpt-4o`, `gpt-4.1`, `gpt-5-mini`) + **Özel Uç Nokta (Custom URL)** desteği (ör. `https://api.axforge.ai/v1/chat/completions`, yerel `http://localhost` sunucuları)
  - **OpenRouter** (`anthropic/claude-3.5-sonnet`, `google/gemini-2.5-flash`, `openai/gpt-4o`, `deepseek/deepseek-chat`)
- **Çevrimdışı Yerel Yedek:** API anahtarı olmadan düzenli CSV/TSV veya boşluklu tabloları anında ayrıştıran yerel motor.
- **Yapılandırılmış Çıkarım:** `cDNA_change`, `protein_change`, `position_aa`, `position_bp`, `exon`, `mutation_type`, `phenotype_or_type` alanlarını çıkarır; `"30(58)"` gibi birleşik sayımları `family_count` ve `allele_count` olarak ayrı ayrı ayrıştırır.
- **Düzenlenebilir Veri Tablosu:** Grafik öncesinde satır içi düzenleme, sıralama, arama, doğrulama uyarıları ve CSV/JSON içe & dışa aktarım.

### 2. Gen ve Protein Yapısı Tanımlama
- Protein uzunluğunu (`aa`), cDNA uzunluğunu (`bp`), domainleri ve ekzonları manuel olarak tanımlayın veya JSON/CSV dosyalarından içe aktarın.
- **Tek Tıkla Otomatik Çekme:** Gen sembolü (ör. `ITGB2`, `NFKB1`, `TP53`) ile **UniProt** (protein uzunluğu ve domainler) ve **Ensembl** (kanonik transkript kodlayıcı ekzonları) üzerinden verileri otomatik çekin.

### 3. İki Farklı Akademik Yayın Kalitesinde Saf SVG Grafik Modu
- **Mod 1 — Protein Domain & Detaylı Mutasyon Haritası:**
  - N-ucundan C-ucuna yatay protein çubuğu, renkli domain blokları ve aminoasit cetveli.
  - Fenotipe, mutasyon tipine, dönüşümlü veya yalnızca üste göre yerleşim bölme.
  - Çok katmanlı çakışma önleyici yatay yerleşim, 45°/90° açılı etiketler ve 3 parçalı lider çizgiler.
- **Mod 2 — cDNA / Ekzon Frekans Haritası (Lollipop & Genişleyen Piramit Kümeleri):**
  - Orantılı ekzon blokları ve altında isteğe bağlı protein domain şeridi.
  - Aile veya allel sayısına göre sembolleri üst üste dizer; belirlenen eşiği aşan sıcak noktalarda (hotspot) yukarı doğru 2'li/3'lü/4+'lü kompakt piramit kümeleri oluşturur.
  - Çakışmasız yatay küme yerleşimi ve ekzon üzerindeki gerçek `bp` noktasına bağlanan çaprazlanmayan açılı alt çizgiler.
  - **Direkt şeklin üstünde** (oksuz) veya **ok/çizgi ile üstte** etiket modları; etiketlere özel yazı tipi, punto, kalınlık, renk, açı ve içerik seçimi.

### 4. İnteraktif Stüdyo, Çift Dil Desteği ve Dışa Aktarma
- **Çift Dil Arayüz (`TR` / `EN`):** Üst çubuktan Türkçe ve İngilizce arasında anında geçiş yapın.
- **Sürükle-Bırak + Geri/İleri Al:** Grafik üzerindeki hem mutasyon etiketlerini hem de Mod 2 şekil kümelerini fareyle taşıyabilirsiniz (`Ctrl+Z` / `Ctrl+Shift+Z`).
- **Canlı Stil ve Filtreleme:** Akademik önayarlar (*Nature / Science*, *NEJM / Blood*, *Siyah-Beyaz Baskı*), mutasyon tipi bazlı renk/şekil/boyut özelleştirme, tipografi, lejant konumu ve mutasyon tipi/fenotip/minimum sayı/pozisyon filtreleri.
- **Yayın Kalitesinde Dışa Aktarım:**
  - **SVG** (Adobe Illustrator ve Inkscape ile düzenlenebilir saf vektör)
  - **PDF** (Electron `printToPDF` ile gerçek vektörel PDF)
  - **PNG** (**300 DPI** ve **600 DPI**, gömülü `pHYs` fiziksel DPI başlığı ile)
- **Proje Kaydı:** Tüm veri, manuel konum, stil ve filtre ayarlarını `.json` proje dosyası olarak kaydedip yeniden açın (API anahtarları `safeStorage` ile yerel cihazda şifrelenir, proje dosyasına yazılmaz).

---

## Teknoloji Yığını

- **Masaüstü & Derleme:** Electron 33, Vite 6, TypeScript 5, `electron-builder`
- **Arayüz & Durum:** React 18, Zustand, Tailwind CSS, Lucide Icons
- **Görselleştirme & Doğrulama:** D3.js (`scaleLinear`, renk kontrastı), Saf SVG, Zod
- **PDF & Raster Dışa Aktarım:** Electron `printToPDF`, `jsPDF` + `svg2pdf.js`, HTML5 Canvas + PNG `pHYs` kodlayıcı
- **Test:** Vitest

---

## Geliştirme ve Derleme

### Gereksinimler
- Node.js `>= 20`
- npm

### Komutlar

```bash
# Bağımlılıkları kur
npm install

# Birim testlerini çalıştır
npm test

# Geliştirme modunda başlat (Vite HMR + Electron)
npm run dev

# Tip kontrolü ve üretim derlemesi
npm run build

# Üretim derlemesiyle masaüstü uygulamasını başlat
npm run start:electron

# Mevcut işletim sistemi için kurulum paketi üret (release/ klasörüne)
npm run package

# Windows NSIS kurulum (.exe) ve Portable (.zip) paketlerini üret
npm run package:win
```

---

## Otomatik GitHub Sürümleri (Releases)

Depoda yer alan [`.github/workflows/release.yml`](.github/workflows/release.yml) iş akışı, yeni bir sürüm etiketi (`v*`) gönderildiğinde **Linux** (`.AppImage`, `.deb`), **Windows** (`.exe` kurulum ve portable `.zip`) ve **macOS** (`.dmg`) çalıştırılabilir dosyalarını otomatik olarak derleyip GitHub Releases sayfasına yükler:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Geliştirici

**Batuhan Aydogan** — [github.com/ikirenk](https://github.com/ikirenk)

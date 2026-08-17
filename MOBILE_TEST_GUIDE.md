# 📱 Mobile Testing Guide

## Quick Start

### 1. Start Dev Server
```bash
cd c:\laragon\www\youngscreative
.\start-dev.ps1
```

Atau manual:
```bash
# Terminal 1 - Backend
cd backend && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

### 2. Open Chrome DevTools
1. Buka http://localhost:3000
2. Press `F12` atau `Ctrl+Shift+I`
3. Click **Toggle Device Toolbar** (ikon mobile) atau `Ctrl+Shift+M`
4. Pilih device preset atau set custom dimensions

---

## 📱 Test Devices

### Mobile Phones
| Device | Resolution | Breakpoint |
|--------|------------|------------|
| iPhone SE | 375 x 667 | Mobile (default) |
| iPhone 12/13 Pro | 390 x 844 | Mobile (default) |
| iPhone 14 Pro Max | 430 x 932 | Mobile (default) |
| Samsung Galaxy S20 | 360 x 800 | Mobile (default) |
| Pixel 5 | 393 x 851 | Mobile (default) |

### Tablets
| Device | Resolution | Breakpoint |
|--------|------------|------------|
| iPad Mini | 768 x 1024 | md: (tablet) |
| iPad Air | 820 x 1180 | md: (tablet) |
| iPad Pro 11" | 834 x 1194 | lg: (desktop-like) |

### Desktop
| Resolution | Breakpoint |
|------------|------------|
| 1280 x 720 | md: / lg: |
| 1920 x 1080 | lg: / xl: |

---

## ✅ Test Checklist

### 1. LoginPage (http://localhost:3000/login)
- [ ] Form tidak terpotong di mobile
- [ ] Input fields mudah diketik (h-12 cukup tinggi)
- [ ] Tombol "Sign in" mudah di-tap (min-h 52px)
- [ ] Show/hide password icon responsif
- [ ] Demo credentials terbaca di semua device

**Test:**
```
Email: fotografer@demo.com
Password: password123
```

---

### 2. Dashboard (http://localhost:3000)
- [ ] Hamburger menu muncul di pojok kanan atas (mobile)
- [ ] Klik hamburger → drawer slide dari kiri
- [ ] Stats cards stacked vertical di mobile
- [ ] "New Session" button mudah di-tap
- [ ] Session list jadi cards (bukan table) di mobile
- [ ] Klik card → navigate ke detail sesi

**Mobile Layout:**
```
┌─────────────────────┐
│  📊 Stats Cards     │
│  (vertical stack)   │
├─────────────────────┤
│  ➕ New Session    │
├─────────────────────┤
│  📋 Recent Sessions │
│  [Card 1]           │
│  [Card 2]           │
│  [Card 3]           │
└─────────────────────┘
```

---

### 3. Hamburger Menu
- [ ] Button visible di mobile (fixed top-right)
- [ ] Klik → drawer slide smooth dari kiri
- [ ] Backdrop semi-transparent visible
- [ ] Close button (X) di header drawer
- [ ] Nav items tinggi cukup untuk tap (56px)
- [ ] User info card visible dengan email
- [ ] "Sign Out" button merah dengan border

**Interactions:**
- Tap hamburger → open
- Tap backdrop → close
- Tap X button → close
- Tap nav item → close & navigate

---

### 4. Klien Landing (http://localhost:3000/k/zvli8y606kt4cqwl)
- [ ] Header text tidak terlalu kecil
- [ ] Mode selection cards stack vertical
- [ ] Each card mudah di-tap (min-h preserved)
- [ ] Card text readable (responsive font)
- [ ] Active scale feedback saat tap
- [ ] Arrow button visible di setiap card

**Mode Cards:**
```
┌──────────────────────────┐
│ 📷 Full Selection        │
│ Pilih Sendiri           │
│ Description...          │
│                    →    │
└──────────────────────────┘
```

---

### 5. Klien Galeri (setelah pilih mode)
- [ ] Top navbar compact (h-14)
- [ ] Back button mudah di-tap
- [ ] Session name truncate jika terlalu panjang
- [ ] Tabs: "Seleksi" dan "Hasil" (label pendek di mobile)
- [ ] Filter chips horizontal scroll smooth
- [ ] Photo grid 2 kolom di mobile
- [ ] Gap antar foto cukup (8px)
- [ ] Tap foto → navigate ke detail

**Grid Layout Mobile:**
```
┌─────┬─────┐
│ 📷  │ 📷  │
├─────┼─────┤
│ 📷  │ 📷  │
├─────┼─────┤
│ 📷  │ 📷  │
└─────┴─────┘
```

---

### 6. Foto Detail (tap salah satu foto)
**Desktop:**
- [ ] Foto preview di kiri
- [ ] Sidebar di kanan (w-96)
- [ ] Navigation arrows visible

**Mobile:**
- [ ] Foto full-width
- [ ] Sidebar HIDDEN
- [ ] Tune button (⚙️) muncul di top-right
- [ ] Navigation arrows lebih besar (48x48px)
- [ ] Tap tune button → bottom sheet slide up
- [ ] Bottom sheet max-height 85vh
- [ ] Handle bar visible di top sheet
- [ ] Selection buttons tinggi cukup (60px)
- [ ] "Save & Next" button min-h 52px
- [ ] Tap backdrop → close sheet

**Bottom Sheet Test:**
```
1. Tap foto dari galeri
2. Foto full-screen muncul
3. Tap ⚙️ button di navbar
4. Sheet slide up dari bawah
5. Pilih "Ready to Edit"
6. Add notes (opsional)
7. Tap "Save & Next"
8. Sheet close, navigate ke foto next
```

---

### 7. Tab Hasil Edit (fase pasca_edit)
- [ ] Tab bar scroll horizontal jika perlu
- [ ] "Unduh Semua (ZIP)" button visible
- [ ] Grid hasil edit 2 kolom mobile
- [ ] "Beri Tanggapan" button expand inline
- [ ] Textarea cukup besar untuk typing
- [ ] "Setuju" dan "Revisi" buttons side-by-side

---

## 🎯 Touch Target Verification

**Minimum Size: 44x44px**

Gunakan Chrome DevTools Ruler:
1. Right-click element → Inspect
2. Computed tab → check width/height
3. Atau hover → tooltip shows dimensions

**Critical Elements:**
- ✓ Hamburger menu: 48x48px
- ✓ Back buttons: 44x44px
- ✓ Primary buttons: 52px height
- ✓ Nav arrows (foto detail): 48x48px
- ✓ Filter chips: 40px height
- ✓ Tune button: 44x44px

---

## 🐛 Common Issues to Check

### Layout Issues
- [ ] No horizontal scroll di semua viewport
- [ ] No content terpotong di mobile
- [ ] Margins/padding consistent
- [ ] Text tidak overlap dengan icons

### Typography
- [ ] Font size readable (min 11px)
- [ ] Line-height cukup (1.5 minimum)
- [ ] Contrast ratio WCAG AA (4.5:1)

### Interactive
- [ ] Buttons respond to tap (tidak delay)
- [ ] Active states visible (scale 0.98)
- [ ] Disabled states greyed out
- [ ] Loading spinners visible

### Performance
- [ ] Animations smooth 60fps
- [ ] No jank saat scroll
- [ ] Images lazy load
- [ ] Transitions < 300ms

---

## 🔧 Debug Tools

### Chrome DevTools
```
F12 → Toggle Device Toolbar (Ctrl+Shift+M)
```

**Network Throttling:**
- Fast 3G (simulate mobile network)
- Slow 3G (worst case)

**Performance:**
- Performance tab → Record → Stop
- Check for layout shifts, jank

**Responsive:**
- Rotate device (portrait ↔ landscape)
- Resize viewport manually
- Test notch devices (iPhone X+)

---

## 📸 Screenshot Test Points

Ambil screenshot untuk dokumentasi:

1. **Mobile Dashboard**
   - Hamburger menu visible
   - Stats cards stacked
   - Session cards list

2. **Hamburger Drawer**
   - Open state with backdrop
   - Nav items dengan icons
   - User info card

3. **Klien Landing**
   - Mode selection cards
   - All 3 options visible

4. **Foto Detail Bottom Sheet**
   - Sheet open state
   - Selection buttons
   - Action buttons

5. **Grid Layouts**
   - 2-column photo grid mobile
   - Card list dashboard mobile

---

## ✅ Sign-off Criteria

**Pass if:**
- ✅ All pages render correctly mobile & desktop
- ✅ No horizontal scroll anywhere
- ✅ All buttons min 44x44px touch target
- ✅ Animations smooth (no jank)
- ✅ Text readable (min 11px)
- ✅ Forms usable with mobile keyboard
- ✅ No console errors in DevTools

**Ready for Production:**
- Manual test passed on 3+ devices
- Real device testing (iOS + Android)
- Performance audit score > 90

---

## 🚀 Next Steps After Testing

### If All Tests Pass:
```bash
git push -u origin main
```

### If Issues Found:
1. Document issue dengan screenshot
2. Note viewport/device yang bermasalah
3. Fix issue di code
4. Re-test affected pages
5. Commit fixes

### Performance Optimization:
- Run Lighthouse audit (mobile mode)
- Check bundle size: `npm run build --report`
- Lazy load below-fold content
- Optimize images via proxyUrl

---

**Testing Time Estimate:** 30-45 menit  
**Critical Path:** Login → Dashboard → Foto Detail → Bottom Sheet

Happy Testing! 🎉

# 📚 Từ vựng tiếng Anh - Chứng chỉ Claude Builder

Web app flashcard học từ vựng tiếng Anh từ tài liệu chứng chỉ **Anthropic Claude Builder**. Thiết kế cho người **mất gốc / A1-A2** muốn vừa học tiếng Anh, vừa làm quen thuật ngữ AI.

## 🚀 Cách dùng

1. **Nháy đúp `index.html`** để mở trong Chrome / Edge / Firefox.
2. Tab **Hôm nay**: học 7 từ/ngày mặc định.
   - Đọc từ tiếng Anh + IPA → đoán nghĩa
   - Bấm **Lật thẻ** (hoặc nháy vào thẻ) để xem nghĩa
   - Bấm **🔊** để nghe phát âm
   - Đánh giá: **Khó / Bình thường / Dễ** → app tự lên lịch ôn lại
3. Tab **Chủ đề**: duyệt 110 từ chia 9 nhóm. Click vào từ bất kỳ để xem chi tiết.
4. Tab **Tiến độ**: số ngày học liên tục (streak), từ đã thuộc theo chủ đề.

## 🧠 Cách app sắp xếp ôn tập (SRS Leitner)

| Bạn đánh giá | Ôn lại sau |
|---|---|
| 😣 Khó | 1 ngày |
| 🙂 Bình thường | 2 → 4 → 8 → 16 ngày (tăng dần) |
| 😎 Dễ | nhảy nhanh hơn |

Từ "thuộc" = đánh giá Dễ ở box 5. App sẽ không hỏi lại từ đó.

## 📁 Cấu trúc file

```
tu-vung-tieng-anh/
├── index.html         # Mở file này để chạy app
├── styles.css         # Giao diện
├── app.js             # Logic flashcard + SRS
├── vocabulary.js      # 110 từ vựng (sửa file này để thêm từ)
├── vocabulary.json    # Bản JSON gốc (tham khảo)
└── README.md
```

## ➕ Thêm / sửa từ vựng

Mở **`vocabulary.js`** (KHÔNG phải file .json) bằng Notepad / VS Code, thêm 1 entry vào mảng `words`:

```js
{
  "id": "mot-id-duy-nhat",
  "word": "your_word",
  "ipa": "/jɔː wɜːd/",
  "pos": "noun",
  "topic": "basics",
  "meaning_everyday_vi": "nghĩa thường ngày",
  "meaning_ai_vi": "nghĩa trong AI",
  "example_en": "Example sentence.",
  "example_vi": "Câu dịch.",
  "tip_vi": "Mẹo nhớ."
}
```

Lưu file, reload trang (F5) → từ mới xuất hiện trong topic tương ứng.

## 💾 Lưu tiến độ

Tiến độ lưu trong **localStorage** của trình duyệt (key `claude-vocab-progress-v1`). 

⚠️ **Lưu ý:**
- Mỗi trình duyệt lưu riêng → mở Chrome thì không thấy tiến độ trên Edge.
- Xóa cookies / dữ liệu trang web sẽ mất hết tiến độ.
- Có nút "⚠️ Xóa tiến độ" trong tab Tiến độ nếu muốn reset.

## 🔊 Phát âm

Dùng Web Speech API có sẵn trong trình duyệt (không cần internet sau khi load trang). Nếu không nghe được:
- Mở loa máy lên.
- Trên Chrome: lần đầu có thể phải click vào trang trước khi cho phép phát âm.
- Firefox đôi khi cần cài thêm voice package — nếu yên lặng thì dùng Chrome/Edge.

## ⌨️ Mẹo dùng nhanh

- Nháy bất kỳ đâu trên thẻ = lật thẻ
- Nút loa 🔊 phát âm
- Số từ/ngày có thể chỉnh từ 3-30 (mặc định 7)

## ❓ Câu hỏi thường gặp

**Q: Tại sao chỉ có 110 từ?**  
A: Đây là 110 từ vựng cốt lõi nhất xuất hiện trong tài liệu Claude Builder. Học chắc 110 từ này → đọc tài liệu Anthropic hiểu được ~70-80%.

**Q: Tôi mới A1-A2 mà từ này khó quá?**  
A: Học từ topic "Cơ bản" trước, mỗi từ có nghĩa thường ngày kèm theo để giúp bạn liên kết với từ vựng đã biết.

**Q: Có cần internet không?**  
A: Không. Sau khi mở trang lần đầu, app chạy hoàn toàn offline.

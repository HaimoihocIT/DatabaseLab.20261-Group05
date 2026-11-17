# DMS – Phân công công việc chi tiết

| Thành viên | Vai trò | Mảng nghiệp vụ |
|---|---|---|
| **Hải Lọ** (A) | Đăng ký và hạ tầng | STUDENT, SEMESTER, REGISTRATION, PREFERS, repo, CI, tài liệu |
| **Hải Bùi** (B) | Phòng và xếp phòng | BUILDING, ROOM_TYPE, ROOM, ROOM_STATUS_HISTORY, MAINTENANCE_REQUEST, ROOM_ASSIGNMENT |
| **Đức** (C) | Điện nước và hóa đơn | ROOM_MONTHLY_USAGE, UTILITY_TARIFF_TIER, INVOICE |

**Nguyên tắc chung**
- Mỗi người sở hữu trọn một mảng: bảng, ràng buộc, trigger, function, test, dữ liệu mẫu và query của mảng đó.
- Mỗi file trong `db/` chỉ có **một** người sở hữu. Muốn sửa file của người khác thì tạo Issue và nhờ người đó sửa, hoặc mở PR và gắn họ làm reviewer.
- Mỗi người dùng database riêng bằng Docker, dựng lại bằng `scripts/reset.sh`. Không ai sửa trực tiếp trong database. Mọi thay đổi phải đi qua file `.sql` và Pull Request.
- Mã SQL xuất phát: lấy từ các phụ lục A, B, C, D của file `DMS_constraints_triggers_functions.md` rồi tách theo người.
- Review chéo theo vòng: Hải Lọ review PR của Hải Bùi, Hải Bùi review PR của Đức, Đức review PR của Hải Lọ.

**Thứ tự phụ thuộc giữa các bảng**

```
STUDENT, SEMESTER ──► REGISTRATION ──► PREFERS
                           │
BUILDING, ROOM_TYPE ──► ROOM ──► ROOM_ASSIGNMENT ──► INVOICE
                           │                            ▲
                           └──► ROOM_MONTHLY_USAGE ─────┘ (đọc khi phát hành hóa đơn)
```

Vì vậy giai đoạn 1 cần merge theo thứ tự: Hải Lọ → Hải Bùi → Đức. Mỗi người vẫn có thể bắt đầu ngay phần không phụ thuộc (xem từng mục).

---

## Giai đoạn 0 – Khởi tạo (chủ yếu Hải Lọ, 2 người còn lại hỗ trợ)

### Hải Lọ
- [ ] Tạo repo GitHub `dms-db`, mời Hải Bùi và Đức làm collaborator.
- [ ] Tạo cấu trúc thư mục: `db/`, `queries/`, `tests/`, `scripts/`, `docs/`.
- [ ] Viết `docker-compose.yml` (image `postgres:16`, mount `db/` vào `docker-entrypoint-initdb.d`), `.env.example` và `.gitignore` (`.env`, file trung gian LaTeX).
- [ ] Viết `scripts/reset.sh` (xóa volume và dựng lại) và `scripts/test.sh` (reset rồi chạy mọi file trong `tests/`).
- [ ] Viết workflow CI `.github/workflows/db.yml`: dựng DB từ đầu bằng các file `db/*.sql`, rồi chạy `tests/*.sql`.
- [ ] Bật branch protection cho `main`: bắt buộc PR, cần 1 người duyệt, CI phải xanh, cấm push thẳng.
- [ ] Tạo GitHub Project (cột Todo, In progress, Review, Done), các Milestone cho 5 giai đoạn, PR template và Issue template.
- [ ] Viết `README.md`: cách cài Docker, chạy `reset.sh`, quy ước nhánh và commit, ai sở hữu file nào.
- [ ] Tạo Issue cho **mọi công việc trong tài liệu này** và gán người phụ trách.
- [ ] Đưa file `.tex` và các file `.md` hiện có vào `docs/`.

### Hải Bùi và Đức
- [ ] Cài Docker, clone repo, chạy `reset.sh` thành công trên máy mình.
- [ ] Đọc kỹ tài liệu thiết kế và các phần đã viết sẵn của mảng mình.

**Xong giai đoạn 0 khi:** cả ba người chạy được `reset.sh` và `test.sh` trên máy mình, CI chạy xanh trên một PR thử.

---

## Giai đoạn 1 – Bảng và ràng buộc khai báo

### Hải Lọ
- [ ] `db/000_extensions.sql`: `btree_gist`.
- [ ] `db/010_helpers.sql`: `fn_vn_date`, `fn_month_end`.
- [ ] `db/100_registration.sql`: bảng STUDENT, SEMESTER, REGISTRATION, PREFERS với đủ kiểu dữ liệu, PK, FK, `UNIQUE`, `CHECK` và `EXCLUDE` (semester không chồng nhau).
- [ ] Mở PR đầu tiên, nhờ Hải Bùi review. **Merge sớm nhất có thể** vì hai người kia phụ thuộc vào đây.
- [ ] Viết `tests/test_registration.sql` cho phần ràng buộc khai báo: trùng `citizen_id`, hai đơn cùng sinh viên và học kỳ, học kỳ chồng nhau, đơn Approved không có `reviewed_at`.

### Hải Bùi
- [ ] **Có thể bắt đầu ngay, không cần chờ:** `db/200_rooms.sql` phần BUILDING, ROOM_TYPE, ROOM, ROOM_STATUS_HISTORY, MAINTENANCE_REQUEST (không phụ thuộc bảng của Hải Lọ).
- [ ] Sau khi PR của Hải Lọ được merge: thêm ROOM_ASSIGNMENT (có FK tới REGISTRATION), `EXCLUDE` theo `registration_id`, partial unique index cho `initial`.
- [ ] Tạo index phục vụ truy vấn: `room_assignment(room_id, starts_on)`, `room_status_history(room_id)`.
- [ ] Viết `tests/test_rooms.sql` cho ràng buộc khai báo: trùng số phòng trong tòa, giai đoạn trạng thái chồng nhau, giới tính tòa không hợp lệ, ticket Completed không có `completed_at`.

### Đức
- [ ] **Có thể bắt đầu ngay:** `db/300_billing.sql` phần UTILITY_TARIFF_TIER (không phụ thuộc bảng nào), gồm `CHECK` cho `tier_upper > tier_lower` và quy tắc dòng internet.
- [ ] Sau khi bảng ROOM của Hải Bùi được merge: thêm ROOM_MONTHLY_USAGE.
- [ ] Sau khi ROOM_ASSIGNMENT được merge: thêm INVOICE với khóa ngoại phức hợp 3 cột, `UNIQUE(registration_id, billing_month)` và các `CHECK` (tổng tiền, paid_at và payment_method, due_date).
- [ ] Tạo index: `invoice(billing_month)`, `invoice(paid_at)`.
- [ ] Viết `tests/test_billing.sql` cho ràng buộc khai báo: internet `tier_lower <> 0`, tổng tiền sai, `paid_at` không có phương thức thanh toán.

**Xong giai đoạn 1 khi:** `reset.sh` dựng được toàn bộ 12 bảng, `test.sh` xanh.

---

## Giai đoạn 2 – Trigger và function (làm song song)

### Hải Lọ
- [ ] `db/400_triggers_registration.sql`: **T1** `fn_registration_guard`: quyết định duyệt là cuối cùng, không đổi `student_id` và `semester_id`.
- [ ] Test T1: đổi Approved sang Rejected phải bị chặn, đổi sinh viên của đơn phải bị chặn.
- [ ] Hỗ trợ: rà lại toàn bộ danh sách trigger và function với bản thiết kế xem còn thiếu luật nào không.
- [ ] Review PR của Hải Bùi (T2, T3, T4).

### Hải Bùi
- [ ] `db/500_triggers_rooms.sql`:
  - [ ] **T2** `fn_check_room_assignment`, chia thành từng PR nhỏ theo luật:
    - [ ] R1 đơn phải Approved, R2 lần ở nằm trong học kỳ.
    - [ ] R3 giới tính sinh viên khớp tòa.
    - [ ] R4 phòng không Unsafe trong thời gian ở.
    - [ ] R5 không vượt sức chứa (kiểm tra tại `starts_on` mới và các `starts_on` khác nằm trong khoảng), có khóa dòng phòng.
    - [ ] R6 `initial` phải thuộc loại phòng trong PREFERS và là lần ở sớm nhất; `transfer` hoặc `safety_relocation` phải nối tiếp lần ở trước.
    - [ ] R7 sửa `ends_on` không làm hóa đơn đã phát hành bị lệch; khóa chính và `change_type` bất biến.
  - [ ] **T3** `fn_check_safety_relocation` (deferred constraint trigger).
  - [ ] **T4** `fn_check_unsafe_status`: không đánh dấu Unsafe khi còn người ở.
- [ ] `db/700_functions.sql` phần của mình: `sp_change_room`, view `v_unsafe_room_occupants`.
- [ ] Test (mỗi luật ít nhất một ca hợp lệ và một ca vi phạm): chuyển phòng đúng ngày cuối tháng, chuyển phòng do không an toàn trong một transaction, phòng đầy, ngoài học kỳ, loại phòng không thuộc PREFERS.
- [ ] Test đồng thời: hai kết nối cùng xếp người vào phòng còn một chỗ, chỉ một kết nối thành công.
- [ ] Review PR của Đức.

### Đức
- [ ] `db/600_triggers_billing.sql`:
  - [ ] **T5** `fn_assert_tiers` và `fn_check_tariff_tiers` (deferred): các bậc bắt đầu từ 0, liên tục, chỉ bậc cuối để mở.
  - [ ] **T6** `fn_usage_freeze`: usage đã finalize thì không sửa, không xóa.
  - [ ] **T7** `fn_invoice_guard`: insert (lần ở bao phủ ngày cuối tháng, usage đã finalize), update (chỉ đặt `paid_at` và `payment_method` một lần), delete bị cấm.
- [ ] `db/700_functions.sql` phần của mình: `fn_tier_cost`, `fn_internet_fee`, `fn_generate_invoices`.
- [ ] Test: khoảng hở hoặc chồng nhau trong biểu giá, giá trị biên của từng bậc (đúng 50 kWh, 100 kWh), điện nước dùng 0, phát hành hóa đơn hai lần (không tạo trùng), phòng chưa finalize bị bỏ qua, tính tiền khi một người chuyển phòng giữa tháng, kết quả làm tròn.
- [ ] Review PR của Hải Lọ.

**Xong giai đoạn 2 khi:** mọi trigger và function có test, CI xanh trên `main`.

---

## Giai đoạn 3 – Dữ liệu mẫu và query

Mỗi người viết seed cho mảng của mình vào một file riêng và dùng cùng một **bộ dữ liệu thống nhất** (thỏa thuận số lượng trước: ví dụ 2 tòa nam, 1 tòa nữ, khoảng 30 phòng, khoảng 80 sinh viên, 2 học kỳ liên tiếp). Seed phải chạy được theo thứ tự `db/9xx_seed_*.sql` và **không vi phạm trigger**.

### Hải Lọ
- [ ] `db/910_seed_registration.sql`: sinh viên (nam, nữ), 2–3 học kỳ, đơn đăng ký đủ ba trạng thái Pending, Approved, Rejected, PREFERS.
- [ ] Query (mỗi query một file `queries/a_XX_*.sql`):
  - [ ] `a_01` Số đơn theo học kỳ và trạng thái, tỷ lệ duyệt.
  - [ ] `a_02` Sinh viên đã Approved nhưng chưa được xếp phòng.
  - [ ] `a_03` Loại phòng được yêu cầu nhiều nhất theo học kỳ.
  - [ ] `a_04` Thời gian trung bình từ lúc nộp đến lúc duyệt.
  - [ ] `a_05` Sinh viên từng bị từ chối hoặc chưa bao giờ nộp đơn.
  - [ ] `a_06` Lịch sử đăng ký của một sinh viên qua các học kỳ.

### Hải Bùi
- [ ] `db/920_seed_rooms.sql`: tòa, loại phòng, phòng, lịch sử trạng thái (có một phòng từng Unsafe), ticket bảo trì, các lần ở bao gồm ít nhất một ca `transfer` và một ca `safety_relocation`.
- [ ] Query (`queries/b_XX_*.sql`):
  - [ ] `b_01` Phòng còn chỗ trống theo tòa và loại phòng tại một ngày cho trước.
  - [ ] `b_02` Tỷ lệ lấp đầy từng tòa.
  - [ ] `b_03` Lịch sử ở của một sinh viên (phòng, từ ngày, đến ngày, lý do chuyển).
  - [ ] `b_04` Ticket bảo trì chưa hoàn thành, sắp theo mức ưu tiên và số ngày tồn đọng.
  - [ ] `b_05` Phòng có nhiều ticket nhất, thời gian xử lý trung bình theo loại sự cố.
  - [ ] `b_06` Danh sách sinh viên đang ở một phòng, và sinh viên đã phải chuyển phòng do phòng không an toàn.

### Đức
- [ ] `db/930_seed_billing.sql`: biểu giá điện, nước, internet; usage ít nhất 3 tháng (đã finalize); chạy `fn_generate_invoices`; đánh dấu một phần hóa đơn đã thanh toán, một phần chưa.
- [ ] Query (`queries/c_XX_*.sql`):
  - [ ] `c_01` Hóa đơn chưa thanh toán và quá hạn, kèm số ngày trễ.
  - [ ] `c_02` Doanh thu theo tháng, tách theo từng khoản (tiền phòng, điện, nước, internet).
  - [ ] `c_03` Top phòng tiêu thụ điện, nước cao nhất theo tháng.
  - [ ] `c_04` Tổng tiền một sinh viên đã trả hoặc còn nợ qua các học kỳ.
  - [ ] `c_05` Phòng có tiêu thụ nhưng cuối tháng không có người ở (tiền điện nước không thu được).
  - [ ] `c_06` Tỷ lệ thanh toán đúng hạn theo tòa.
- [ ] Kiểm chứng: tổng `rent + elec + water + internet` mỗi phòng khớp với tính tay một ví dụ.

**Xong giai đoạn 3 khi:** `reset.sh` nạp xong toàn bộ seed không lỗi, 18 query chạy được và có kết quả có ý nghĩa.

---

## Giai đoạn 4 – Hoàn thiện và bảo vệ

### Hải Lọ
- [ ] Gộp phần slide của cả nhóm vào `docs/` và biên dịch bằng theme HUST; sửa các slide bị tràn khung.
- [ ] Cập nhật file `.md` ràng buộc, trigger, function cho khớp mã cuối cùng.
- [ ] Chạy kiểm tra cuối: clone repo mới, `reset.sh`, `test.sh`, tất cả phải xanh.
- [ ] Dựng database demo từ nhánh `main` (nếu cần dùng database chung chỉ để xem).
- [ ] Tạo tag `v1.0` khi nộp bài.

### Hải Bùi
- [ ] Soạn phần slide về phòng, xếp phòng và các trigger T2, T3, T4.
- [ ] Chuẩn bị kịch bản demo: một transaction chuyển phòng do không an toàn từ đầu đến cuối.

### Đức
- [ ] Soạn phần slide về điện nước, hóa đơn và các trigger T5, T6, T7.
- [ ] Chuẩn bị kịch bản demo: phát hành hóa đơn một tháng, ví dụ tính tiền 852.500 đồng, thử sửa hóa đơn bị chặn.

### Cả ba người
- [ ] Tập bảo vệ và chuẩn bị trả lời câu hỏi của phần mình (xem bên dưới).

---

## Câu hỏi mỗi người cần trả lời được khi bảo vệ

**Hải Lọ**
- Vì sao REGISTRATION là strong entity chứ không phải weak entity dù phụ thuộc tồn tại vào STUDENT?
- Làm sao đảm bảo một sinh viên chỉ có một đơn mỗi học kỳ và đơn bị từ chối không nộp lại được?
- Vì sao semester không chồng nhau và điều đó giúp ích gì cho các ràng buộc khác?

**Hải Bùi**
- Vì sao ROOM_ASSIGNMENT là relationship M:N có khóa thời gian, và khóa tối thiểu của nó là gì?
- Làm sao chống vượt sức chứa khi hai người cùng đăng ký một chỗ trống (khóa dòng phòng)?
- Vì sao dùng khoảng nửa mở `[starts_on, ends_on)`, và chuyển phòng đúng ngày 31 xử lý thế nào?
- Vì sao `gender` đặt ở BUILDING và quy trình chuyển người khi phòng không an toàn?

**Đức**
- Vì sao INVOICE là multivalued attribute của ROOM_ASSIGNMENT mà không phải entity riêng?
- Công thức chia điện nước bậc thang cho nhiều người ở, và ví dụ số cụ thể?
- Hóa đơn được bảo vệ "không đổi sau khi phát hành" bằng cơ chế nào?
- Vì sao biểu giá cần trigger deferred và dòng internet được lưu thế nào?

---

## Quy ước làm việc

- **Nhánh:** `feat/<người>-<việc>`, ví dụ `feat/bui-assignment-r5`. Sửa lỗi dùng `fix/...`.
- **Commit:** `feat(rooms): add capacity check R5`, `test(billing): add tier boundary cases`.
- **Pull Request:** mỗi PR làm một việc, có test đi kèm, ghi `Closes #<số issue>`, chờ CI xanh và một người duyệt mới merge.
- **Họp ngắn mỗi tuần:** xem bảng GitHub Projects, việc nào bị kẹt và ai đang chờ ai.
- **Gặp vướng mắc về thiết kế** (ví dụ cần đổi cột của bảng người khác): mở Issue gắn tên chủ sở hữu, không tự sửa.

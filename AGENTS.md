# Thiết lập và làm việc với Supabase DMS trên Windows

Dành cho agent hỗ trợ developer Group 05. Mục 1–6 hướng dẫn dựng một checkout và PostgreSQL local riêng, rồi xác nhận `npm.cmd run db:verify` đạt trên đúng máy đó. Mục 7 hướng dẫn tạo migration, áp dụng file SQL, kiểm thử, mở PR và đồng bộ sau merge. Xem [README.md](README.md) để tra cứu thêm.

## 1. Nhận đúng repository

Mở Windows PowerShell hoặc terminal PowerShell trong VS Code. Kiểm tra `git --version` trước khi clone. Nếu thiếu Git, cài Git for Windows theo mục 2. Dùng thư mục checkout và tài khoản GitHub của developer đang onboarding. Nếu đã có checkout, kiểm tra remote và thay đổi hiện có trước khi cập nhật. Giữ nguyên các file người dùng đang chỉnh sửa.

```powershell
git clone https://github.com/HaimoihocIT/DatabaseLab.20261-Group05.git
Set-Location DatabaseLab.20261-Group05
git status --short --branch
git remote get-url origin
```

Chạy `git clone` khi chưa có checkout. Dùng `main` sau khi PR setup được merge. Nếu nhóm đang review PR setup, có thể kiểm tra ngay trên một checkout mới của nhánh `chore/supabase-setup` bằng `git clone --branch chore/supabase-setup https://github.com/HaimoihocIT/DatabaseLab.20261-Group05.git`. Chủ máy tự xác thực GitHub nếu được yêu cầu. Agent tiếp tục các bước độc lập trong khi chờ quyền clone.

Trước khi cài dependencies, xác nhận đang ở thư mục chứa `package-lock.json`, `supabase/config.toml` và `scripts/local.mjs`. Nếu các file thiếu, kiểm tra nhánh đã nhận đúng bộ setup.

## 2. Kiểm tra và cài công cụ còn thiếu

```powershell
$PSVersionTable.PSVersion
[System.Environment]::OSVersion.Version
[System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture
Get-Command git,node,npm.cmd,npx.cmd,docker -ErrorAction SilentlyContinue |
    Select-Object Name,Source
git --version
```

| Công cụ | Điều kiện để tiếp tục |
|---|---|
| Windows và PowerShell | Máy đã kiểm thử dùng Windows x64 và PowerShell. Toàn bộ lệnh chạy trong PowerShell. |
| Git for Windows | `git --version` hoạt động. Nếu thiếu, lấy từ [Git for Windows](https://git-scm.com/download/win). |
| Node.js và npm | Node 24 LTS, lấy bản chuẩn của nhóm từ `.nvmrc`. npm đi kèm Node. |
| Docker Desktop | Chạy engine Linux containers, có đủ dung lượng cho images/data và xuất cổng trên loopback. |
| Supabase CLI | Dùng bản khóa trong `package-lock.json`, cài vào repository bằng `npm.cmd ci`. |

**Node.js.** Nếu chưa có Node 24, dùng bản Node chính thức. Có thể tải ZIP portable và đối chiếu SHA256 theo mục 2 của [README.md](README.md#2-yêu-cầu-và-cài-công-cụ-trên-từng-máy). Sau khi giải nén, nạp PATH cho phiên PowerShell hiện tại. Đoạn sau dùng bản portable x64 đã kiểm thử.

```powershell
$nodeVersion = (Get-Content -LiteralPath .nvmrc -Raw).Trim()
$portableNode = Join-Path $PWD ".tools\node-v$nodeVersion-win-x64"
if (Test-Path -LiteralPath (Join-Path $portableNode 'node.exe')) {
    $env:Path = "$portableNode;$env:Path"
}
node --version
npm.cmd --version
```

Mở PowerShell mới sau khi cài bằng installer. Nếu dùng portable, nạp lại PATH ở mỗi phiên PowerShell mới. Dùng `npm.cmd` và `npx.cmd` khi PowerShell chặn file `npm.ps1` hoặc `npx.ps1`.

**Docker Desktop.** Nếu chưa có, lấy bộ cài được ký từ [hướng dẫn Docker Windows](https://docs.docker.com/desktop/setup/install/windows-install/) và chọn cài cho tài khoản hiện tại khi có lựa chọn đó. Chủ máy tự hoàn tất điều khoản và xác thực. Docker Desktop dùng backend ảo hóa để chạy Linux containers trên Windows. Với backend WSL 2 của Docker Desktop, developer vẫn thao tác trong PowerShell và không cần thêm distro để phát triển dự án. Nếu cần quyền quản trị, bật tính năng Windows, reboot hoặc xử lý xung đột công cụ, đưa lỗi cụ thể cho chủ máy và chờ phê duyệt.

Trong Docker Desktop, chọn **Settings → Resources → Network → Port binding behavior → Localhost by default**, rồi Apply/restart. Kiểm tra engine và context trước khi chạy database.

```powershell
docker --version
docker context ls
docker info --format '{{.OSType}} {{.ServerVersion}}'
```

`docker info` phải trả `linux` và phiên bản engine. Context phải trỏ tới Docker Desktop trên máy này qua Windows named pipe. Nếu PowerShell chưa nhận lệnh `docker`, mở phiên mới hoặc thêm thư mục `resources\bin` của bản Docker Desktop đã cài vào PATH phiên làm việc. Mục troubleshooting trong README có cả đường dẫn cài theo user và cài toàn máy.

## 3. Cài dependencies và dựng database

```powershell
npm.cmd ci
npx.cmd --no-install supabase --version
if (-not (Test-Path -LiteralPath .env)) {
    Copy-Item -LiteralPath .env.example -Destination .env
}
git check-ignore -- .env
docker ps -a --filter 'name=dms-group05' --format '{{.Names}}'
docker volume ls --filter 'name=dms-group05' --format '{{.Name}}'
```

Dừng ở bước lỗi. CLI phải khớp bản khóa trong repo. `.env` phải được Git ignore và có thể để trống các trường kết nối khi chỉ chạy database. Kết quả kiểm tra container/volume trước lần start giúp phân biệt database mới với dữ liệu đã có. Nếu tên project trùng với một checkout khác trên cùng Docker engine, xác định chủ sở hữu trước khi tiếp tục.

```powershell
npm.cmd run db:start
npm.cmd run db:status
npm.cmd run db:migrate
npm.cmd run db:verify
```

Lần đầu `db:start` tải images và chạy migration cùng seed. Chờ các service sẵn sàng. `db:migrate` áp dụng migration chờ trên local và giữ dữ liệu. Các lệnh `db:*` dùng Supabase CLI của repo. Khi cần dừng project, dùng `npm.cmd run db:stop` để giữ dữ liệu.

| Dịch vụ | Địa chỉ mặc định trên máy developer |
|---|---|
| Studio | `http://127.0.0.1:54323` |
| API | `http://127.0.0.1:54321` |
| PostgreSQL | `127.0.0.1:54322`, database `postgres` |

Lấy thông tin kết nối local trong terminal riêng bằng `npx.cmd --no-install supabase status` khi người dùng cần cấu hình ứng dụng. Lệnh hiển thị credentials, nên với kiểm tra thông thường hãy dùng `db:status` để xem trạng thái đã ẩn keys. Local chạy độc lập với Cloud staging và không cần đăng nhập tài khoản Supabase.

## 4. Kiểm thử và xác nhận khả năng dựng lại

- `db:verify` phải thành công. Với bộ setup ban đầu, bảng `setup_meta.workflow_probe` có đúng một dòng `local-seed-ok`, RLS bật, schema private và migration `20261117151141` có trong lịch sử local. REST, Auth và Studio trả HTTP 200.
- Chỉ chạy reset khi chính phiên setup này vừa tạo database local, chưa có volume dự án trước đó và đã xác minh target. Nếu đã có dữ liệu hoặc chưa chắc target, ghi **SKIP** cho reset và xin phê duyệt trước thao tác làm mất dữ liệu.

```powershell
npm.cmd run db:status
docker port supabase_db_dms-group05 5432/tcp
npx.cmd --no-install supabase db query 'SELECT current_database(), current_user;' --read-only
```

`docker port` chỉ được hiện `127.0.0.1:54322` và có thể kèm `[::1]:54322`. Truy vấn phải báo target local ở `127.0.0.1:54322`, database `postgres`. Với database mới đã xác minh, chạy:

```powershell
npm.cmd run db:reset -- --confirm-local-reset
```

Wrapper kiểm tra đúng container, context Docker và cổng local trước khi reset, rồi chạy lại `db:verify`. Dùng Supabase CLI làm công cụ migration duy nhất. Giữ nguyên lịch sử migrations đã chia sẻ. Chỉ triển khai schema nghiệp vụ sau khi ERD/spec được phê duyệt.

## 5. Khi gặp lỗi

| Triệu chứng | Việc cần làm |
|---|---|
| Docker engine chưa chạy | Mở Docker Desktop, chờ engine sẵn sàng, rồi kiểm tra lại `docker info`. |
| Cổng bận | Dùng `Get-NetTCPConnection -State Listen` để xác định cổng và `OwningProcess`. Hỏi chủ máy nếu cần dừng ứng dụng khác. |
| Cổng không giới hạn loopback | Kiểm tra lại **Port binding behavior** trong Docker Desktop rồi chạy lại `db:start` theo README. |
| CLI khác bản hoặc thiếu binary | Chạy lại `npm.cmd ci` theo lockfile và xác nhận đang dùng Node 24. |
| Image pull hoặc npm bị chặn | Kiểm tra mạng và dung lượng ổ lưu Docker. Ghi lại lỗi và chạy lại sau khi nguyên nhân được xử lý. |
| Service unhealthy hoặc migration lỗi | Đọc lỗi CLI và log của đúng container. Lọc credentials trước khi chia sẻ. Với database có sẵn, ưu tiên chẩn đoán trước thao tác reset. |

## 6. Bàn giao kết quả cho developer

Báo trong chat phiên bản Windows, Git, Node/npm, Docker, Supabase CLI và PostgreSQL. Ghi `PASS`, `FAIL` hoặc `SKIP` cho từng mục startup, migrations, schema/seed/RLS, HTTP services và reset. Kèm dòng kết quả đã rút gọn, URL local và cách xử lý blocker. Chỉ đánh dấu `PASS` cho kiểm thử đã chạy trên máy này. Không đưa password, token, API keys, `.env`, Docker volumes hoặc link metadata vào commit hay báo cáo.

## 7. Quy trình làm việc với file SQL

Mỗi developer làm trên nhánh riêng và database local riêng. Kiểm tra ERD/spec đã duyệt và phạm vi được giao trước khi thay đổi schema. SQL cần phiên bản hóa để đổi schema hoặc dữ liệu dùng chung nằm trong `supabase/migrations/`. Dữ liệu giả phục vụ test local nằm trong `supabase/seed.sql`. Truy vấn `SELECT` dùng để kiểm tra kết quả có thể chạy trực tiếp trên local.

### Tạo nhánh và migration

Sau khi PR setup đã merge vào `main`, chạy từng lệnh từ thư mục repo. Nếu checkout có thay đổi, xử lý phần việc đang làm trước khi chuyển nhánh. Dừng nếu lệnh trước đó thất bại.

```powershell
git status --short --branch
git switch main
git pull --ff-only origin main
git switch -c feature/db-approved-change
# Chạy npm.cmd ci nếu package-lock.json thay đổi.
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run db:verify
npx.cmd --no-install supabase migration new approved_change
```

Thay tên nhánh và `approved_change` bằng mô tả công việc thật. Mở file mới mà CLI in ra dưới `supabase/migrations/`, viết SQL rồi lưu UTF-8. Giữ timestamp `YYYYMMDDHHMMSS` do CLI sinh. Đặt thay đổi có phụ thuộc sau migration tạo đối tượng mà nó tham chiếu. Bảng cần truy cập qua API phải có quyền và RLS policies phù hợp với spec.

### Sau khi viết xong SQL

1. Đọc lại file vừa sửa và kiểm tra thao tác ảnh hưởng dữ liệu hiện có. Với `DROP`, `TRUNCATE`, đổi kiểu có thể làm mất dữ liệu hoặc cập nhật hàng loạt, dừng trước khi áp dụng và xác nhận phạm vi với chủ dự án.
2. Áp dụng file bằng Supabase CLI trên local. Chạy từng lệnh bên dưới và kiểm tra lịch sử có timestamp mới ở phía database. Nếu migration thay đổi schema khác `public` hoặc `setup_meta`, bổ sung schema đó vào danh sách lint.

   ```powershell
   npm.cmd run db:migrate
   npx.cmd --no-install supabase migration list
   npx.cmd --no-install supabase db lint --schema public,setup_meta --fail-on error
   npm.cmd run db:verify
   ```

3. Kiểm tra kết quả của SQL mới bằng truy vấn trên Studio local hoặc `supabase db query --read-only`. Ví dụ, đối chiếu cột, khóa và constraint với spec. Với thay đổi quyền, thử một trường hợp được phép và một trường hợp bị từ chối bằng role của ứng dụng. `db:verify` kiểm tra hạ tầng và lịch sử migrations. Kiểm thử theo spec xác nhận phần nghiệp vụ.
4. Chứng minh cả chuỗi migrations chạy được từ đầu bằng mục 4 trên database local mới đã xác minh. Sau reset, thử lại các kiểm thử liên quan đến SQL mới và seed. Nếu local đang có dữ liệu cần giữ, ghi **SKIP** cho reset và nêu lý do trong PR. `db:migrate` giữ dữ liệu và áp dụng các timestamp còn thiếu. Seed được nạp khi dựng database mới hoặc reset.

Chạy migration qua CLI để lịch sử được ghi đúng. Không dán nguyên file migration vào SQL Editor rồi chạy `db:migrate` tiếp. Nếu `db:migrate` lỗi, đọc lỗi SQL đầu tiên và đối chiếu migration history với các file trước khi thử lại. Nếu bạn sửa file sau khi nó đã chạy local, CLI nhận ra timestamp cũ và sẽ không chạy lại file đó. Với file chưa chia sẻ, kiểm thử bản sửa trên database local mới theo mục 4. Với file đã merge hoặc đã chạy trên staging, giữ nguyên file cũ và tạo migration mới để sửa.

### Commit, review và merge

Kiểm tra staging area trước khi dùng ví dụ này. Nếu có file đã stage của việc khác, giữ nguyên và xử lý riêng. Chỉ chọn đúng file migration do mình tạo và `supabase/seed.sql` nếu có thay đổi seed thuộc cùng việc.

```powershell
git status --short
git diff --cached --name-only
$migrationFile = Read-Host 'Tên file migration .sql vừa tạo, gồm timestamp'
if ($migrationFile -notmatch '^\d{14}_[a-z0-9_]+\.sql$') { throw 'Tên migration không hợp lệ' }
git add -- "supabase/migrations/$migrationFile"
# Nếu việc này có sửa seed, chạy: git add -- supabase/seed.sql
git diff --cached --check
git diff --cached
git commit -m 'feat(db): add approved migration'
# Chỉ push sau khi được phép.
git push -u origin HEAD
```

Mở PR từ feature branch vào `main`. Ghi rõ mục đích SQL, file phụ thuộc, tác động lên dữ liệu hoặc quyền, kết quả migrate/verify/kiểm thử nghiệp vụ và kết quả reset local nếu đã chạy. Một thành viên khác review SQL và thứ tự migrations trước khi người có quyền merge.

Nếu `main` có migration mới trong lúc làm việc, cập nhật feature branch sạch bằng `git fetch origin` rồi `git merge origin/main`. Kiểm tra cả xung đột Git lẫn hai file cùng đổi một đối tượng SQL. Nếu trùng timestamp, dùng CLI tạo timestamp mới cho migration của mình khi file chưa chia sẻ. Sau khi xử lý, chạy lại các kiểm thử local. Nếu database history và file trên nhánh lệch nhau, dùng [cách xử lý conflicts trong README](README.md#9-xử-lý-conflicts-khi-nhiều-người-cùng-tạo-migration). Không tự sửa lịch sử migrations hoặc dùng `--include-all` để ép chạy.

### Đồng bộ sau merge và đưa lên staging

Các thành viên chuyển về `main` khi checkout sạch, pull code và áp dụng migration mới trên database riêng.

```powershell
git switch main
git pull --ff-only origin main
# Chạy npm.cmd ci nếu package-lock.json thay đổi.
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run db:verify
```

Maintainer triển khai staging từ `main` đã review. Đối chiếu project ref và danh sách migrations bằng dry-run, lấy phê duyệt cho đợt deploy, rồi kiểm tra lại history sau khi áp dụng. Việc push GitHub và thay quyền truy cập cũng cần được phép. Tuyệt đối không reset Cloud. Xem [quy trình Cloud staging trong README](README.md#10-cloud-staging--chỉ-thực-hiện-sau-quyền-và-phê-duyệt).

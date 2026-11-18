# Dormitory Management System — Supabase cho nhóm 3 người trên Windows

Repository quản lý cấu hình Supabase, SQL migrations và seed. Mỗi developer chạy một bộ Supabase riêng bằng Docker Desktop trên máy Windows; Supabase Cloud staging dùng chung cho integration testing/demo. Chưa triển khai schema nghiệp vụ DMS: chỉ có bảng kiểm tra hạ tầng `setup_meta.workflow_probe`.

Khi nhờ agent cài môi trường trên máy thành viên, giao cho agent đọc [AGENTS.md](AGENTS.md) và chạy checklist trên máy đó.

**Tất cả lệnh bên dưới chạy trong Windows PowerShell, tại thư mục gốc repository.** Dùng `npm.cmd` và `npx.cmd` để tránh lỗi execution policy của `npm.ps1`. Không cần terminal Linux, Git Bash hoặc môi trường lập trình trong WSL. Docker Desktop cần backend chạy Linux containers; trên Windows Home, chọn backend WSL 2 tích hợp của Docker Desktop. Không cần cài thêm Ubuntu để làm dự án.

## 1. Quy tắc và phân tách môi trường

| Môi trường | Ai sử dụng | Dữ liệu / thông tin kết nối | Cách thay đổi schema |
|---|---|---|---|
| Local | Một developer trên một máy Windows | `127.0.0.1`, Docker volumes riêng; dữ liệu giả | SQL migration + Supabase CLI local |
| Cloud staging | Cả nhóm, integration/demo | Project staging riêng, credentials riêng | Maintainer deploy từ `main` sau phê duyệt |
| Production | Chỉ tạo sau khi có yêu cầu và phê duyệt | Project, secrets, backup và quyền riêng | Quy trình phát hành được duyệt riêng |

- Supabase CLI là **công cụ migration duy nhất**. Không dùng Flyway, Prisma Migrate, `docker-entrypoint-initdb.d`, hay script tự áp dụng SQL song song.
- Chỉ tạo bảng DMS sau khi ERD/spec được phê duyệt. Không lấy nội dung phân công làm sự phê duyệt schema.
- Mọi thay đổi schema phải nằm trong migration được review. Không sửa schema trực tiếp trên Cloud Studio.
- Chỉ reset database local dùng dữ liệu có thể bỏ hoặc đã sao lưu. Không reset Cloud, không dùng `stop --no-backup`, Docker prune hoặc xóa volumes trong quy trình thông thường.
- Không commit `.env`, passwords, tokens, service-role/secret keys, dumps hay volumes. Không đưa mật khẩu Cloud vào dòng lệnh/lịch sử PowerShell.
- Không tự tạo/link Cloud, deploy, push Git, sửa collaborator/branch protection hoặc bật CI deploy khi chưa có quyền và phê duyệt tương ứng.
- `WorkAssignment.md` là tài liệu phân công có sẵn, có thể nằm ở thư mục gốc hoặc `docs/`. Dùng hướng dẫn trong README này để cài môi trường và quản lý migrations bằng Supabase CLI.

## 2. Yêu cầu và cài công cụ trên từng máy

| Công cụ | Phiên bản / điều kiện |
|---|---|
| Windows | Windows 11 64 bit còn được Docker hỗ trợ; máy kiểm tra hiện tại: build 26200 |
| PowerShell | Windows PowerShell 5.1 hoặc PowerShell 7 |
| Git | Git for Windows; bản kiểm tra: 2.52.0.windows.1 |
| Node.js | Dòng 24 LTS; phiên bản nhóm: **24.22.3**, ghi trong `.nvmrc` |
| npm | Đi kèm Node.js; bản kiểm tra: 11.19.1 |
| Docker Desktop | Linux containers, engine đang chạy; bản đã kiểm thử: 4.99.0, engine 29.9.3 |
| Supabase CLI | **3.2.0**, dev dependency đã khóa bằng `package-lock.json` |
| Tài nguyên | Tối thiểu 8 GB RAM theo yêu cầu Docker; khuyến nghị 16 GB và ít nhất 20 GB trống trên ổ lưu Docker images/data, không chỉ ổ chứa repository |

Không cần cài PostgreSQL Server, `psql`, Node global Supabase, hoặc Docker Compose riêng. `psql` đã nằm trong container PostgreSQL. Lần đầu cần Internet để tải dependencies và Docker images; không cần tài khoản Supabase Cloud để chạy local.

### Git và Docker Desktop

1. Cài Git for Windows từ [git-scm.com](https://git-scm.com/download/win). Nếu Git đã hoạt động thì giữ bản hiện có. Nếu cần UAC/admin, dừng để người có quyền phê duyệt.
2. Tải Docker Desktop từ [hướng dẫn Windows chính thức](https://docs.docker.com/desktop/setup/install/windows-install/). Chọn cài cho tài khoản hiện tại nếu installer hỗ trợ; không tự nâng quyền để cài toàn máy.
3. Mở Docker Desktop từ Start Menu, hoàn tất màn hình khởi động/điều khoản. Chọn Linux containers và backend WSL 2. Không cần bật tích hợp với một distro Ubuntu.
4. Trong **Settings > Resources > Network > Port binding behavior**, chọn **Localhost by default**, rồi Apply/restart Docker Desktop. Đây là thiết lập Docker Desktop cho tài khoản Windows, cần làm trên cả ba máy; xem [Docker networking](https://docs.docker.com/desktop/features/networking/). Chỉ dùng network option của Docker chưa đủ để bảo đảm giới hạn cổng trên Docker Desktop. Nếu thiết lập bị tổ chức khóa, dừng và nhờ người quản lý xử lý.
5. Nếu Docker yêu cầu bật tính năng Windows, thay đổi BIOS/virtualization, admin hoặc reboot Windows: dừng và nhờ chủ máy xử lý. Không tự thay đổi các thiết lập đó.
6. Chờ Docker Desktop báo engine đang chạy. Mở PowerShell mới để nhận PATH.

```powershell
git --version
docker --version
docker info --format '{{.OSType}}'
```

Lệnh cuối phải trả về `linux`; đó là loại container bên trong Docker Desktop, dù toàn bộ công việc phát triển chạy trên Windows.

### Node.js 24 LTS và npm

Cài Node.js 24.22.3 từ [trang tải Node.js chính thức](https://nodejs.org/en/download), hoặc dùng ZIP portable chính thức dưới đây để không cần admin. Đoạn ZIP chạy sau khi clone và `Set-Location` vào repository; chỉ chạy khi chưa có Node 24 phù hợp:

```powershell
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$nodeVersion = (Get-Content .nvmrc -Raw).Trim()
$nodeArchive = "node-v$nodeVersion-win-x64.zip"
$nodeBase = "https://nodejs.org/dist/v$nodeVersion"
New-Item -ItemType Directory -Path .tools -Force | Out-Null
Invoke-WebRequest -UseBasicParsing "$nodeBase/SHASUMS256.txt" -OutFile .tools\SHASUMS256.txt
Invoke-WebRequest -UseBasicParsing "$nodeBase/$nodeArchive" -OutFile ".tools\$nodeArchive"
$checksumLine = Get-Content .tools\SHASUMS256.txt |
    Where-Object { $_ -match ('\s' + [regex]::Escape($nodeArchive) + '$') }
if (-not $checksumLine) { throw 'Không có SHA256 chính thức cho archive' }
$expectedHash = ($checksumLine -split '\s+')[0]
$actualHash = (Get-FileHash ".tools\$nodeArchive" -Algorithm SHA256).Hash
if ($actualHash -ne $expectedHash) { throw 'SHA256 không khớp; không giải nén/chạy' }
Expand-Archive -LiteralPath ".tools\$nodeArchive" -DestinationPath .tools
$env:Path = "$PWD\.tools\node-v$nodeVersion-win-x64;$env:Path"
node --version
npm.cmd --version
```

Nếu dùng portable, ở **mỗi PowerShell mới** trong repository chạy hai dòng sau; không cần tải/cài lại:

```powershell
$nodeVersion = (Get-Content .nvmrc -Raw).Trim()
$env:Path = "$PWD\.tools\node-v$nodeVersion-win-x64;$env:Path"
```

`.tools/` và npm cache không vào Git. `package.json` giới hạn Node 24 để cả nhóm dùng cùng dòng runtime. Không cài `npm install -g supabase`, không dùng `npx supabase@latest` tùy ý; mọi ví dụ gọi đúng CLI trong repository.

## 3. Clone và setup lần đầu — mỗi developer làm riêng

Mỗi người dùng một checkout trên máy của mình; không chia sẻ Docker data directory, tài khoản Windows hoặc file `.env`.

```powershell
git clone https://github.com/HaimoihocIT/DatabaseLab.20261-Group05.git
Set-Location DatabaseLab.20261-Group05
# Nếu chưa có Node: thực hiện phần cài Node phía trên ngay tại đây.
node --version
npm.cmd --version
docker info --format '{{.OSType}}'
npm.cmd ci
npx.cmd --no-install supabase --version
if (-not (Test-Path -LiteralPath .env)) { Copy-Item -LiteralPath .env.example -Destination .env }
npm.cmd run db:start
npm.cmd run db:verify
```

Không chạy lại `supabase init` trên checkout đã có `supabase/config.toml`. `npm ci` cài theo lockfile, không nâng phiên bản. Chỉ `Copy-Item` khi chưa có `.env`; không ghi đè thông tin local của mình. `.env` là cấu hình cho ứng dụng sau này; CLI/scripts không tự nạp nó.

`db:start` kiểm tra thiết lập localhost của Docker Desktop trước khi chạy, tạo Docker network `dms-group05-local` với host binding `127.0.0.1`, rồi gọi Supabase CLI start và kiểm tra bindings thực tế. Nếu startup validation lỗi, wrapper dừng stack và giữ dữ liệu. Lần đầu có thể mất nhiều phút để tải images, tạo PostgreSQL, áp dụng migrations và seed. Không dùng `--ignore-health-check` để bỏ qua dịch vụ lỗi. Analytics, Edge Runtime và vector storage đã tắt vì chưa cần; PostgreSQL, API, Auth, Studio, Storage, Realtime và email testing vẫn được cấu hình.

Project ID cố định `dms-group05` giúp nhận diện containers; mỗi máy có Docker volumes riêng nên cả ba dùng cùng ID/ports mà vẫn độc lập. Không chạy hai bản sao project này đồng thời trên cùng Docker engine.

## 4. Khởi động, trạng thái và dừng local

```powershell
npm.cmd run db:start
npm.cmd run db:status
npm.cmd run db:verify
npm.cmd run db:stop
```

`db:stop` dùng `supabase stop` mặc định để giữ dữ liệu cho lần start sau. Không sửa/xóa volumes thủ công. Scripts kiểm tra Docker context là named pipe local của Windows và từ chối Docker qua TCP/SSH. Nếu đang dùng context remote, chọn Docker Desktop local trước khi tiếp tục; không đổi context của các công việc khác khi chưa kiểm tra.

`db:status` ẩn keys/passwords và hiển thị containers, trạng thái, URL. Muốn lấy **keys local** cho `.env`, chạy riêng trong terminal cá nhân:

```powershell
npx.cmd --no-install supabase status
```

Không dán output chứa secret/service-role key vào PR, issue hay chat. Điền local anon/publishable key vào `SUPABASE_ANON_KEY` và `VITE_SUPABASE_ANON_KEY` nếu sau này dùng Vite. Chỉ backend được đọc service-role/secret key; frontend không được đọc `DATABASE_URL` hoặc service-role key.

## 5. Kết nối Studio, PostgreSQL và API

| Dịch vụ | Địa chỉ local mặc định |
|---|---|
| Studio | `http://127.0.0.1:54323` |
| Supabase API | `http://127.0.0.1:54321` |
| REST | `http://127.0.0.1:54321/rest/v1/` |
| Auth health | `http://127.0.0.1:54321/auth/v1/health` |
| PostgreSQL | Host `127.0.0.1`, port `54322`, database `postgres`, user `postgres` |
| Email testing | `http://127.0.0.1:54324` |
| Shadow DB | Port `54320`, CLI dùng khi diff; không dùng cho ứng dụng |

`DATABASE_URL` trong `.env.example` để trống. Khi ứng dụng cần PostgreSQL, lấy chuỗi kết nối local từ `npx.cmd --no-install supabase status` trong terminal riêng rồi điền vào `.env`. Các services local chỉ xuất cổng trên loopback.

### Kiểm tra PostgreSQL không cần cài psql

```powershell
docker exec supabase_db_dms-group05 psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'SELECT version();'
docker exec supabase_db_dms-group05 psql -X -U postgres -d postgres -v ON_ERROR_STOP=1 -c 'TABLE setup_meta.workflow_probe;'
npx.cmd --no-install supabase db query 'SELECT current_database(), current_user;' --read-only
npx.cmd --no-install supabase migration list
```

Bảng probe phải có đúng dòng `1 | local-seed-ok`. Trong CLI **3.2.0**, `migration list`, `migration up`, `db lint`, `db reset` và `db push` mặc định target local; Cloud phải chỉ rõ `--remote`. Không suy luận hành vi này cho bản CLI khác. Wrapper npm khóa đối số và không nhận flags Cloud.

### VS Code

Trong VS Code, cài extension PostgreSQL của nhà cung cấp bạn tin cậy, tạo connection với host/port/database/user như bảng trên, nhập password local trong ô mật khẩu và chọn SSL disabled cho local. Kết nối thử `SELECT current_database(), current_user;` rồi `TABLE setup_meta.workflow_probe;`. Nếu extension hỗ trợ, lưu password trong credential store; không lưu vào workspace settings. `.vscode/` bị ignore vì profile có thể chứa thông tin kết nối.

Chỉ dùng SQL editor để đọc/kiểm tra. Mọi DDL dùng migration. `setup_meta` không xuất qua REST nên không thấy bảng probe trong API là đúng.

### Web/backend sau này

Repository hiện chưa có ứng dụng; không cần cài SDK để setup database. Khi có app, cài SDK trong thư mục app và để app nạp file môi trường của nó. Ví dụ Vite dùng SDK `@supabase/supabase-js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);
```

Backend kết nối PostgreSQL qua `DATABASE_URL` local trong `.env`; SDK server dùng `SUPABASE_URL` và key phù hợp. Nếu chạy backend trong Docker, `127.0.0.1` bên trong container là chính container đó; cần thiết kế Docker networking riêng khi có app, không mở DB ra mọi interfaces để chữa tạm. Trước khi expose bảng nghiệp vụ, migration phải bật RLS, định nghĩa policies và cấp quyền tối thiểu; cấu hình local đang đặt `api.auto_expose_new_tables = false`.

## 6. Tạo, sửa và áp dụng migrations

Tên chuẩn: `YYYYMMDDHHMMSS_mo_ta_ngan.sql`; timestamp do CLI tạo theo UTC. Không đánh số `001`, không tạo timestamp thủ công, không dùng cùng timestamp cho hai migration.

Chỉ chạy ví dụ tạo migration khi có thay đổi đã được phân công/phê duyệt:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/dev-a-approved-change
npx.cmd --no-install supabase migration new approved_change
Get-ChildItem supabase\migrations | Sort-Object Name
```

Mở file vừa tạo trong VS Code, viết SQL cần thiết rồi lưu UTF-8. Khi chưa được review/merge và chưa deploy, có thể sửa migration của nhánh mình; nếu migration đã áp dụng local, sửa file không tự chạy lại, phải tái tạo local theo phần reset khi dữ liệu được phép bỏ. Nếu đã merge hoặc áp dụng trên Cloud: giữ file cũ, tạo migration mới để sửa tiếp.

```powershell
npm.cmd run db:migrate
npx.cmd --no-install supabase migration list
npx.cmd --no-install supabase db lint --schema public,setup_meta --fail-on error
npm.cmd run db:verify
```

`db:migrate` gọi `supabase migration up`, chỉ áp dụng các file chưa có trong lịch sử local; **không chạy seed lại**. Kiểm thử bằng truy vấn phù hợp với thay đổi. Lint không thay thế test ràng buộc, quyền truy cập hoặc RLS. `db:verify` chỉ kiểm tra hạ tầng hiện tại, migration history và probe; khi có nghiệp vụ phải bổ sung kiểm thử nghiệp vụ đã thống nhất.

Không dùng `psql -f` để áp dụng migrations, không tự sửa `supabase_migrations.schema_migrations`. Không thêm hệ thống declarative schema hay migrator khác. `db diff` của CLI có thể hỗ trợ tạo SQL sau này, nhưng phải review file diff và không dùng Studio làm nguồn schema duy nhất.

## 7. Reset local và seed an toàn

Reset xóa dữ liệu local rồi chạy toàn bộ migrations theo thứ tự và `supabase/seed.sql`. Chỉ dùng trên database mới hoặc dữ liệu bạn xác nhận có thể bỏ; dừng nếu chưa chắc target hoặc giá trị dữ liệu. Sau reset, Realtime có thể còn khởi động dù PostgreSQL đã sẵn sàng; wrapper chờ services ở trạng thái `starting` tối đa 90 giây, rồi mới kiểm tra schema/API. Services lỗi hoặc unhealthy vẫn làm kiểm tra thất bại.

```powershell
npm.cmd run db:status
docker port supabase_db_dms-group05 5432/tcp
docker exec supabase_db_dms-group05 psql -X -U postgres -d postgres -c 'SELECT current_database(), current_user;'
# Chỉ tiếp tục khi target đúng là local của mình và dữ liệu có thể bỏ.
npm.cmd run db:reset -- --confirm-local-reset
```

Port phải là `127.0.0.1:54322` và có thể kèm `[::1]:54322` (IPv6 loopback); database `postgres`. Không chấp nhận `0.0.0.0`, `[::]` hoặc địa chỉ LAN. Wrapper yêu cầu cờ xác nhận, kiểm tra local Docker context, container label/image và loopback binding trước khi gọi `supabase db reset` với danh sách đối số cố định. Không nhận `--remote`, `--linked`, `--db-url` hoặc flags truyền thêm. Không chạy reset trực tiếp để vượt kiểm tra này.

Nếu phải giữ dữ liệu local, sao lưu trước vào thư mục bị ignore; lệnh sau dùng `pg_dump` bên trong đúng container local:

```powershell
New-Item -ItemType Directory -Path backups -Force | Out-Null
$backupName = 'local-' + (Get-Date -Format 'yyyyMMdd-HHmmss') + '.dump'
docker exec supabase_db_dms-group05 pg_dump -U postgres -d postgres -Fc -f "/tmp/$backupName"
docker cp "supabase_db_dms-group05:/tmp/$backupName" "backups\$backupName"
```

Xác nhận file backup có dữ liệu và có kế hoạch phục hồi trước khi reset; không coi dump là lý do tự động được phép phá dữ liệu. `/tmp` ở ví dụ là đường dẫn bên trong container, các lệnh vẫn chạy trong PowerShell.

Seed hiện dùng dữ liệu giả cố định và `ON CONFLICT`, chỉ tạo một dòng probe để xác nhận đường chạy migration → seed. Khi schema nghiệp vụ được duyệt, thêm seed giả không chứa PII/password thật. Dữ liệu tham chiếu **bắt buộc có trên Cloud** phải đi trong migration được review; seed local không tự deploy lên Cloud. Không thêm `--include-seed` khi deploy shared Cloud theo thói quen.

## 8. Quy trình Git cho 3 developers

Phân vai A/B/C: mỗi người có nhánh và database local riêng. Một người làm maintainer staging; reviewer luân phiên A → B → C → A. Nhóm có thể đổi tên/luân phiên vai trò mà không đổi credentials cho nhau.

### Bắt đầu công việc

```powershell
git status --short
git switch main
git pull --ff-only origin main
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run db:verify
git switch -c feature/dev-a-short-description
```

Nếu working tree chưa sạch, commit/stash công việc phù hợp trước khi chuyển nhánh; không tự reset/xóa thay đổi. Các lệnh Git trong README là thao tác developer thực hiện khi được phép push.

### Commit và Pull Request

Trước commit đầu tiên trên mỗi checkout, tự đặt Git identity cho đúng người; không cấu hình tên/email của người khác:

```powershell
$developerName = Read-Host 'Tên hiển thị Git của bạn'
$developerEmail = Read-Host 'Email GitHub hoặc địa chỉ noreply của bạn'
git config --local user.name $developerName
git config --local user.email $developerEmail
```

Git identity không cấp quyền push. Mỗi người dùng tài khoản GitHub riêng đã được chủ repository cấp quyền; xác thực HTTPS qua [Git Credential Manager của Git for Windows](https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git) khi Git yêu cầu. Không đặt token trong remote URL, script hoặc README. Nếu thiếu quyền, nhờ chủ repository xử lý theo phê duyệt; không dùng chung token.

Với PR bàn giao ban đầu, chạy trên checkout có bộ setup sau khi kiểm tra `git diff --cached --name-only` không liệt kê file nào. Stage riêng các file setup để giữ phần chỉnh sửa tài liệu phân công trong công việc của người sửa.

```powershell
git diff --check
git status --short
git switch -c chore/supabase-setup
$setupFiles = @(
    'README.md', 'AGENTS.md', '.env.example', '.gitignore', '.gitattributes', '.npmrc', '.nvmrc',
    'package.json', 'package-lock.json', 'scripts/local.mjs',
    'supabase/.gitignore', 'supabase/config.toml', 'supabase/seed.sql',
    'supabase/migrations/20261117151141_bootstrap_workflow.sql'
)
git add -- @setupFiles
git diff --cached --check
git diff --cached
git commit -m 'chore(db): initialize Supabase migration workflow'
# Chỉ push khi được cấp quyền và cho phép.
git push -u origin chore/supabase-setup
```

Với tính năng mới, chạy migration, kiểm thử local và kiểm tra khả năng dựng lại bằng reset có xác nhận trên DB được phép bỏ. Stage đúng các file của tính năng và đặt commit phù hợp (`feat(db): ...`, `fix(db): ...`).

Trên GitHub, mở Pull Request từ feature branch vào `main`. Mô tả thay đổi, migration/phụ thuộc, kết quả migrate + verify + clean reset, ảnh hưởng dữ liệu và phương án sửa tiến nếu deploy lỗi. Một người khác review SQL, thứ tự migration, RLS/grants và secrets. Chỉ merge khi review chấp thuận, test local đạt và nhánh đã cập nhật với `main`.

Sau khi maintainer có quyền và được phê duyệt, nên cấu hình `main` yêu cầu PR và ít nhất một reviewer; không yêu cầu status check chưa tồn tại. Repository không có workflow tự deploy Cloud. Thêm CI local sau này phải có phạm vi tài nguyên được duyệt; bật deploy Cloud là quyết định riêng.

### Đồng bộ sau khi merge / pull code mới

```powershell
git switch main
git pull --ff-only origin main
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run db:verify
```

Chọn migrate để giữ dữ liệu. Nếu migration mới có timestamp cũ hơn migration đã áp dụng local hoặc bạn chuyển giữa các nhánh có lịch sử khác nhau, xem phần conflicts; không tự dùng `--include-all`. Chỉ reset khi đã xác nhận local và được phép bỏ dữ liệu. Khi seed thay đổi, reset local có xác nhận sẽ nạp lại seed; migrate không tự nạp seed.

## 9. Xử lý conflicts khi nhiều người cùng tạo migration

- **Khác timestamp, cùng sửa một đối tượng:** review SQL và thứ tự phụ thuộc; Git có thể không báo conflict dù SQL xung đột. Merge PR nền tảng trước, cập nhật nhánh còn lại và test lại cả migrate lẫn clean reset.
- **Trùng timestamp:** chỉ đổi migration chưa merge/chưa deploy. Dùng CLI tạo file mới, chuyển SQL của mình vào đó, rồi bỏ đúng file cũ chưa chia sẻ sau khi kiểm tra. Không đổi tên file đã nằm trên shared Cloud hoặc `main`.
- **Timestamp nhánh chậm hơn lịch sử đã merge:** nếu migration nhánh mình chưa chia sẻ, tạo lại bằng `migration new` để timestamp đứng sau phần phụ thuộc. Nếu đã chia sẻ/deploy, dừng và nhờ maintainer thống nhất migration bổ sung; không sửa lịch sử remote.
- **Nhánh khác đã chạy trên local:** lịch sử DB không tự đổi khi checkout Git. Giữ nhánh chứa dữ liệu cần thiết hoặc sao lưu, rồi chỉ reset local khi được phép bỏ dữ liệu. `db:verify` cố ý báo lỗi khi lịch sử DB và thư mục migrations lệch nhau.
- Không dùng `migration repair`, `migration squash`, `--include-all` hoặc sửa bảng history để che lỗi. Chúng có thể làm lịch sử trông đúng trong khi schema thực tế sai.

Để cập nhật một feature branch đang làm, sau khi working tree sạch:

```powershell
git fetch origin
git merge origin/main
# Nếu Git conflict: sửa có review, git add đúng file và hoàn tất merge.
# Nếu không chắc nội dung, dừng; git merge --abort khi muốn hủy merge hiện tại.
npm.cmd run db:migrate
npm.cmd run db:verify
```

Không dùng force push trong quy trình mặc định. SQL lỗi có thể đã thay đổi một phần tùy statements/transaction; luôn kiểm tra trạng thái thực tế trước khi tiếp tục. Với local mới có thể bỏ, sửa migration chưa chia sẻ rồi clean reset; với Cloud, dừng để maintainer xử lý bằng kế hoạch được phê duyệt.

## 10. Cloud staging — chỉ thực hiện sau quyền và phê duyệt

Project staging đã được tạo, link và triển khai migration `20261117151141_bootstrap_workflow.sql` sau khi chủ dự án phê duyệt. Lịch sử local và Cloud khớp, dry-run sau deploy xác nhận đã áp dụng đủ migrations. Các lệnh sau dành cho maintainer khi deploy staging. Mỗi đợt deploy do một người thực hiện để tránh ghi đồng thời vào lịch sử migrations.

| Thuộc tính staging | Giá trị đã kiểm tra |
|---|---|
| Project | `dms-group05-staging` |
| Project ref | `sltndlaqsxvlokqgtrzn` |
| Region | Singapore (`ap-southeast-1`) |
| PostgreSQL | `17.12`, khớp local |
| Dashboard | [Mở project staging](https://supabase.com/dashboard/project/sltndlaqsxvlokqgtrzn) |

CLI hiển thị nhánh chính của project staging là `production`. Khi deploy, đối chiếu tên và project ref trong bảng. Maintainer giữ phiên đăng nhập và metadata link trên máy của mình. Các developer làm local có thể bỏ qua bước đăng nhập Cloud.

1. Người có quyền tạo project trong [Supabase Dashboard](https://supabase.com/dashboard) sau khi phê duyệt organization, chi phí/plan, region, tên staging và người quản lý. Chọn major PostgreSQL tương thích `db.major_version = 17`; nếu Cloud khác major, dừng và thống nhất nâng cấu hình local trước.
2. Lưu DB password trong password manager; lấy project ref từ Dashboard. Không gửi password/token qua Git/chat. Tài khoản maintainer cần quyền project/deploy phù hợp; API anon/service-role key không thay thế access token CLI hoặc DB password.
3. Nếu project mới hoàn toàn, dùng migration trong Git làm nguồn. Nếu đã có bảng/dữ liệu, dừng để đánh giá baseline/drift và backup trước; không `db pull`/repair tùy tiện vì có thể cập nhật lịch sử remote.
4. Với các lần deploy tiếp theo, dùng checkout sạch của `main` đã review, cài đúng dependencies và kiểm thử local. Lấy approval cho project ref, commit/migrations và lịch deploy cụ thể.

```powershell
git switch main
git pull --ff-only origin main
git status --short
npm.cmd ci
npm.cmd run db:start
npm.cmd run db:migrate
npm.cmd run db:verify
# Sau approval, người quản lý tự xác thực trong terminal cá nhân.
npx.cmd --no-install supabase login
$stagingRef = Read-Host 'Project ref của staging đã được phê duyệt'
if ($stagingRef -notmatch '^[a-z]{20}$') { throw 'Project ref không hợp lệ' }
npx.cmd --no-install supabase link --project-ref $stagingRef
npx.cmd --no-install supabase migration list "--remote=$stagingRef"
npx.cmd --no-install supabase db push "--remote=$stagingRef" --dry-run --skip-vault
```

Kiểm tra output target phải là **đúng staging**, đúng danh sách pending migrations và không có SQL ngoài phạm vi. Nếu CLI cần DB password, nhập ở prompt riêng, không dùng `--password` có giá trị trong lịch sử shell. Dry-run vẫn cần network/quyền đọc remote; `--skip-vault` loại việc đồng bộ Vault ngoài migrations.

Sau khi kết quả dry-run đã được xem và phê duyệt triển khai, chạy riêng:

```powershell
npx.cmd --no-install supabase db push "--remote=$stagingRef" --skip-vault
npx.cmd --no-install supabase migration list "--remote=$stagingRef"
```

Giữ xác nhận tương tác khi deploy thủ công. Seed chỉ dùng cho local và mọi thao tác reset Cloud đều bị cấm. Sau deploy, so sánh lịch sử migrations và kiểm thử API của tính năng đã triển khai. Với bootstrap, có thể chạy `SELECT to_regclass('setup_meta.workflow_probe');` trong SQL Editor của project staging để thấy bảng. Bảng hiện có 0 dòng vì seed được giữ ở local.

Kiểm thử Cloud đã xác nhận Auth health HTTP 200 và REST từ chối schema `setup_meta` với HTTP 406 (`PGRST106`). Đường dẫn OpenAPI `/rest/v1/` trả HTTP 401 với key công khai theo [chính sách truy cập OpenAPI của Supabase](https://supabase.com/changelog/42949-breaking-change-removing-access-to-openapi-spec-via-the-anon-key). Kiểm thử đọc dữ liệu nghiệp vụ sẽ thực hiện khi có migration cho bảng nghiệp vụ được duyệt.

`db push` chỉ áp dụng migrations; nó không triển khai web app, không tự đồng bộ Auth redirect, SMTP, policies ngoài SQL hoặc toàn bộ `config.toml`. Các thiết lập staging phải được quản lý và phê duyệt riêng. Không chạy `config push` ngoài phạm vi này.

Cloud credentials của app dùng file local riêng như `.env.staging` bị ignore hoặc secret store của môi trường deploy; không ghi đè `.env` local. Lấy connection string trong Dashboard Connect: chọn direct hoặc session pooler theo network/IPv4/IPv6, giữ TLS theo Dashboard (ưu tiên xác minh CA ở môi trường triển khai), dùng driver/pool phù hợp. Không suy ra host/password từ local. Trên VS Code tạo profile staging riêng với TLS và tên rõ ràng; không dùng profile đó cho reset.

Production cần project tách biệt, approval riêng, backup/restore được kiểm thử, RLS/grants và kế hoạch rollback bằng migration mới. Staging/demo không được xem là production. Chưa cấu hình production hay tự động deploy Cloud qua CI/CD.

## 11. Troubleshooting trên Windows

| Triệu chứng | Kiểm tra và xử lý |
|---|---|
| `node` / `npm.cmd` không nhận diện | Mở PowerShell mới; kiểm tra Node 24 đã cài. Nếu dùng portable, thêm `.tools` vào PATH của phiên terminal theo phần 2. |
| `npm.ps1 cannot be loaded` | Dùng `npm.cmd` / `npx.cmd` như README; không đổi execution policy toàn máy. |
| CLI không có hoặc khác version | Chạy `npm.cmd ci`, rồi `npx.cmd --no-install supabase --version`; phải là 3.2.0. Không cài global/nâng CLI riêng trên một máy. |
| npm download lỗi TLS/proxy/network | Kiểm tra kết nối đến registry.npmjs.org và policy mạng; không tắt TLS verification, không đổi sang registry không rõ nguồn. |
| Không thấy Docker CLI sau cài | Mở lại PowerShell; Docker có thể nằm trong `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin` hoặc `C:\Program Files\Docker\Docker\resources\bin`. Wrapper tự tìm hai vị trí đó. |
| `Cannot connect` / named pipe Docker lỗi | Mở Docker Desktop, chờ engine chạy; `docker info --format '{{.OSType}}'` phải trả `linux`. Không cài Docker Engine độc lập chồng lên Docker Desktop. |
| Docker yêu cầu virtualization/Windows feature/admin | Dừng và nhờ chủ máy xử lý theo hướng dẫn Docker; không tự thay BIOS/tính năng Windows hoặc reboot. |
| Installer báo `docker-compose.exe` bị tiến trình khác sử dụng | Đây là xung đột plugin có sẵn. Dừng cài; kiểm tra `%LOCALAPPDATA%\Docker\install-cli-log.txt`, xác định ứng dụng giữ file nếu có, rồi chỉ đóng ứng dụng sau khi chủ máy đồng ý. Nếu thử lại vẫn lỗi, cần approval riêng cho đổi tên/di chuyển plugin cũ có sao lưu hoặc để chủ máy tự khởi động lại Windows. Không tự xóa plugin, tắt tiến trình hoặc reboot. |
| Wrapper từ chối Docker context | `docker context ls`; kiểm tra context Docker Desktop local. Chỉ chuyển bằng `docker context use desktop-linux` nếu context đó có thật và bạn xác nhận đúng máy local; gỡ `DOCKER_HOST` remote trong phiên làm việc sau khi hiểu cấu hình hiện tại. |
| Wrapper báo port không giới hạn loopback | Dừng stack, chọn Docker Desktop **Settings > Resources > Network > Port binding behavior > Localhost by default**, Apply/restart, rồi `db:start`. Không bỏ guard: option `host_binding_ipv4` trên network có thể chưa đủ với Docker Desktop. |
| Docker image pull timeout / disk thiếu | Kiểm tra Docker Desktop, network/proxy, dung lượng; retry start sau khi nguyên nhân đã xử lý. Không prune/xóa volumes tùy tiện hoặc tắt health checks. |
| Port đang bị chiếm | Dùng lệnh bên dưới để tìm PID; không kill process chưa xác định. Dừng project local khác nếu chủ sở hữu đồng ý, hoặc thống nhất sửa các ports trong config. |
| Một service unhealthy | Xem Docker Desktop Containers hoặc `docker logs --tail 80 TEN_CONTAINER`; output logs có thể chứa dữ liệu nhạy cảm, chỉ chia sẻ sau khi lọc. Không dùng `--ignore-health-check`. |
| Wrapper chỉ báo CLI exit code | Chạy lệnh CLI tương ứng trong terminal cá nhân để xem lỗi; wrapper cố ý không in raw output chứa keys. Khi start dùng đúng `--network-id dms-group05-local`. Không chạy reset trực tiếp để bỏ guard. |
| Migration syntax/constraint lỗi | `migration list`, xem SQL và dữ liệu thực; migration chưa chia sẻ có thể sửa rồi reset local có xác nhận. Migration đã merge/deploy phải sửa bằng file mới. |
| Probe không có / seed sai | Xác nhận config seed enabled và đúng file; `db:migrate` không seed lại. Nếu DB local được phép bỏ, dùng reset có xác nhận rồi verify. |
| PostgreSQL connection refused | Docker đang chạy? DB container healthy? Dùng `127.0.0.1:54322`, không dùng port 5432/54320. Kiểm tra `Test-NetConnection`. |
| API 401 / invalid key | Lấy key từ `supabase status` **local**; kiểm tra API URL cùng môi trường. Không dùng service-role key để chữa lỗi frontend. |
| Bảng không xuất hiện qua REST | Probe nằm trong schema private nên đây là dự kiến. Với bảng nghiệp vụ sau này, review exposed schema, grants, RLS/policies và reload schema theo CLI; không mở quyền hàng loạt. |
| Cloud direct connection lỗi IPv6 | Sau approval, dùng connection string pooler do Dashboard cung cấp nếu network không hỗ trợ direct; giữ TLS. Không thay mật khẩu hoặc cấu hình local để đoán lỗi Cloud. |

```powershell
Get-NetTCPConnection -State Listen |
    Where-Object { $_.LocalPort -in 54320,54321,54322,54323,54324 } |
    Select-Object LocalAddress,LocalPort,OwningProcess
Test-NetConnection 127.0.0.1 -Port 54322
docker ps --filter 'label=com.supabase.cli.project=dms-group05'
docker logs --tail 80 supabase_db_dms-group05
```

Nếu đổi port, stop local trước, sửa `supabase/config.toml`, `.env` cá nhân và cập nhật `.env.example`/README cùng PR. Wrapper đọc port từ config; không đổi `project_id` vì guard nhận diện đúng dự án `dms-group05`. Không dùng local seed/dump có dữ liệu thật để debug chung.

## 12. Cấu trúc repository và lệnh thường dùng

```text
DatabaseLab.20261-Group05/
├── .env.example              # Mẫu kết nối local, keys để trống
├── .gitattributes            # Chuẩn hóa line endings khi cộng tác Windows
├── .gitignore                # Chặn secrets, dependencies, tools, dumps, volumes
├── .npmrc                    # Exact versions, kiểm tra Node engine, cache local
├── .nvmrc                    # Phiên bản Node thống nhất
├── package.json              # CLI dependency và các lệnh local có guard
├── package-lock.json         # Dependency graph và integrity hashes
├── README.md                 # Hướng dẫn setup/cộng tác/phát hành
├── AGENTS.md                 # Hướng dẫn agent dựng và kiểm thử local trên từng máy
├── scripts/
│   └── local.mjs             # Chạy CLI local, loopback network, reset guard, smoke checks
├── supabase/
│   ├── .gitignore            # Bỏ qua trạng thái máy/link tạm do CLI tạo
│   ├── config.toml           # Ports, PostgreSQL 17, services, seed
│   ├── migrations/
│   │   └── 20261117151141_bootstrap_workflow.sql
│   └── seed.sql              # Một dòng dữ liệu giả kiểm tra workflow
└── WorkAssignment.md         # Tài liệu phân công, có thể nằm trong docs/
```

`.env`, `.tools/`, `.npm-cache/`, `node_modules/`, `supabase/.temp/` và Docker volumes là trạng thái riêng từng máy, không commit. Không có file báo cáo audit riêng, Compose stack thứ hai hoặc workflow Cloud deploy.

| Việc cần làm | Lệnh PowerShell |
|---|---|
| Cài đúng dependencies | `npm.cmd ci` |
| Xem CLI version | `npx.cmd --no-install supabase --version` |
| Start / stop | `npm.cmd run db:start` / `npm.cmd run db:stop` |
| Trạng thái, ẩn keys | `npm.cmd run db:status` |
| Đọc keys local riêng tư | `npx.cmd --no-install supabase status` |
| Tạo migration | `npx.cmd --no-install supabase migration new mo_ta` |
| Apply pending local | `npm.cmd run db:migrate` |
| Xem lịch sử local | `npx.cmd --no-install supabase migration list` |
| Kiểm tra hạ tầng | `npm.cmd run db:verify` |
| Lint SQL local | `npx.cmd --no-install supabase db lint --schema public,setup_meta --fail-on error` |
| Reset đã xác nhận local/dữ liệu | `npm.cmd run db:reset -- --confirm-local-reset` |
| Kiểm tra diff | `git diff --check` |

Nâng CLI là thay đổi có review: một người cập nhật dependency exact + lockfile, kiểm tra `--help` vì flags/target có thể đổi giữa major, test local có thể tạo lại, rồi cả nhóm chạy `npm ci`. Không tự xóa local data để nâng công cụ khi chưa được phép.

## 13. Checklist onboarding và nghiệm thu

- [ ] Có GitHub repository access; không chia sẻ tài khoản/token.
- [ ] Windows, Git, Node 24, npm và Docker Desktop hoạt động; Linux containers engine ready; port binding chọn Localhost by default.
- [ ] Clone riêng, `npm ci` thành công, CLI 3.2.0 đúng lockfile.
- [ ] Tạo `.env` từ example; credentials chỉ của local, không đưa keys vào Git.
- [ ] `db:start` hoàn tất; Studio mở được; PostgreSQL/API/Auth và các services cần thiết healthy.
- [ ] `db:verify` PASS: history đúng migrations, schema probe tồn tại, seed một dòng, quyền private và RLS đúng, HTTP REST/Auth/Studio hoạt động.
- [ ] Trên DB local mới/có thể bỏ, xác nhận target rồi reset; verify lại PASS để chứng minh tái tạo từ đầu.
- [ ] Stop/start lại và verify để kiểm tra giữ dữ liệu; không xóa volumes.
- [ ] Tạo feature branch, biết tạo migration/test/review/đồng bộ sau merge; không sửa file đã deploy.
- [ ] Hiểu staging dùng chung, production riêng; chỉ maintainer deploy Cloud sau approval.

Chỉ đánh dấu nghiệm thu runtime khi đã chạy trên máy tương ứng. Kiểm tra syntax/config không chứng minh services hay migrations đã chạy. Nếu Docker, network, quyền hoặc credentials còn thiếu, ghi **SKIP** cùng nguyên nhân, giữ **NO-GO** cho phạm vi chưa kiểm chứng; không suy ra PASS từ việc đã tạo đủ file.

Bản khởi tạo được kiểm thử trên một máy Windows ngày **17/11/2026**: clean dependency install, start, migrate, reset local, seed/schema/RLS, PostgreSQL từ CLI Windows, lint, HTTP REST/Auth/Studio 200 và stop/start giữ dữ liệu đều đạt. Các cổng chỉ bind `127.0.0.1`/`::1`. Thử kết nối tới bốn cổng qua hai interface IPv4 khác của chính máy đều không truy cập được.

Cloud staging đã áp dụng migration bootstrap và kiểm tra schema, RLS, quyền truy cập, lịch sử migrations và API. Để cả nhóm nhận bộ setup, đưa các file trong phần 12 lên GitHub qua Pull Request rồi chạy checklist trên hai máy còn lại. Production là một đợt triển khai riêng.

Tài liệu nguồn: [Supabase CLI/local](https://supabase.com/docs/guides/local-development/cli/getting-started), [SQL migrations](https://supabase.com/docs/guides/local-development/database-migrations), [CLI reference](https://supabase.com/docs/reference/cli/introduction), [Docker Desktop Windows](https://docs.docker.com/desktop/setup/install/windows-install/), [Node.js releases](https://nodejs.org/dist/). Các lệnh được đối chiếu với help của CLI đã khóa; kiểm tra lại khi nâng phiên bản.

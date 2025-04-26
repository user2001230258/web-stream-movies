// Thay thế bằng API Key và Client ID của bạn
const API_KEY = 'AIzaSyB1Akwxrg_9cgUelSaVHSWmqijhuYM7RQA'; // Ví dụ: 'AIzaSyB1Akwxrg_9cgUelSaVHSWmqijhuYM7RQA'
const CLIENT_ID = '298431284956-r4lu6htf8oevjqjka6bralinr1e5k69v.apps.googleusercontent.com'; // Ví dụ: '298431284956-r4lu6htf8oevjqjka6bralinr1e5k69v.apps.googleusercontent.com'
const DISCOVERY_DOCS = ["https://www.googleapis.com/discovery/v1/apis/drive/v3/rest"];
const SCOPES = 'https://www.googleapis.com/auth/drive.readonly';
const FOLDER_ID = '1bf_-Jxekp_Dslh1SxSAskXdk5OhMcdcx'; // ID của thư mục chứa phim

let tokenClient;
let gapiInited = false;
let gisInited = false;

// Khởi tạo Google API Client
function initGapiClient() {
    console.log('Khởi tạo gapi client...');
    gapi.load('client', async () => {
        try {
            await gapi.client.init({
                apiKey: API_KEY,
                discoveryDocs: DISCOVERY_DOCS,
            });
            gapiInited = true;
            console.log('gapi client khởi tạo thành công');
            maybeEnableButtons();
        } catch (err) {
            handleError('Lỗi khởi tạo API', err);
        }
    });
}

// Khởi tạo Google Identity Services
function initGisClient() {
    console.log('Khởi tạo GIS client...');
    if (typeof google === 'undefined') {
        console.log('Google Identity Services chưa tải xong, thử lại sau...');
        setTimeout(initGisClient, 500); // Thử lại sau 500ms
        return;
    }
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (tokenResponse) => {
            if (tokenResponse.error) {
                handleError('Lỗi xác thực', tokenResponse.error);
                return;
            }
            console.log('Xác thực thành công:', tokenResponse);
            gapi.client.setToken(tokenResponse);
            document.getElementById('auth-message').textContent = 'Đã đăng nhập';
            document.getElementById('sign-out').style.display = 'inline-block';
            listFiles();
        },
    });
    gisInited = true;
    console.log('GIS client khởi tạo thành công');
    maybeEnableButtons();
}

// Kích hoạt xác thực khi cả hai client sẵn sàng
function maybeEnableButtons() {
    if (gapiInited && gisInited) {
        console.log('Cả hai client sẵn sàng, yêu cầu token...');
        tokenClient.requestAccessToken();
    }
}

// Lấy danh sách file video từ thư mục cụ thể trong Google Drive
async function listFiles(pageToken = '') {
    console.log('Lấy danh sách file từ Google Drive...');
    try {
        const response = await gapi.client.drive.files.list({
            q: `'${FOLDER_ID}' in parents and mimeType='video/mp4'`,
            fields: 'nextPageToken, files(id, name, thumbnailLink)',
            pageSize: 50,
            pageToken: pageToken,
        });
        console.log('Danh sách file:', response.result.files);
        const files = response.result.files;
        const videoList = document.getElementById('video-list');
        videoList.classList.remove('loading');

        if (files && files.length > 0) {
            files.forEach(file => {
                const item = document.createElement('div');
                item.className = 'video-item';
                if (file.thumbnailLink) {
                    const img = document.createElement('img');
                    img.src = file.thumbnailLink;
                    img.alt = file.name;
                    img.className = 'thumbnail';
                    item.appendChild(img);
                }
                const title = document.createElement('span');
                title.textContent = file.name;
                item.appendChild(title);
                item.onclick = () => playVideo(file.id, file.name);
                videoList.appendChild(item);
            });
            if (response.result.nextPageToken) {
                const loadMore = document.createElement('button');
                loadMore.textContent = 'Tải thêm video';
                loadMore.onclick = () => listFiles(response.result.nextPageToken);
                videoList.appendChild(loadMore);
            }
        } else {
            videoList.textContent = 'Không tìm thấy video MP4 nào trong thư mục.';
        }
    } catch (err) {
        if (err.status === 401) {
            console.log('Token hết hạn, làm mới token...');
            tokenClient.requestAccessToken();
        } else {
            handleError('Lỗi khi lấy danh sách file', err);
        }
    }
}

// Phát video sử dụng alt=media
async function playVideo(fileId, fileName) {
    console.log(`Phát video: ${fileName} (ID: ${fileId})`);
    try {
        const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${gapi.client.getToken().access_token}` },
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const videoSource = document.getElementById('video-source');
        const videoPlayer = document.getElementById('video-player');
        const player = document.getElementById('player');

        videoSource.src = url;
        player.load();
        videoPlayer.style.display = 'block';
        player.play();
        console.log('Video đang phát:', url);
    } catch (err) {
        handleError('Lỗi khi phát video', err);
    }
}

// Đăng xuất
function signOut() {
    console.log('Đăng xuất...');
    google.accounts.oauth2.revoke(gapi.client.getToken().access_token, () => {
        gapi.client.setToken(null);
        document.getElementById('auth-message').textContent = 'Vui lòng đăng nhập để xem video';
        document.getElementById('sign-out').style.display = 'none';
        document.getElementById('video-list').innerHTML = 'Đang tải danh sách video...';
        document.getElementById('video-list').classList.add('loading');
        document.getElementById('video-player').style.display = 'none';
        tokenClient.requestAccessToken();
    });
}

// Xử lý lỗi
function handleError(message, err) {
    const videoList = document.getElementById('video-list');
    videoList.classList.remove('loading');
    videoList.classList.add('error');
    videoList.textContent = `${message}: ${err.message || 'Không xác định'}`;
    console.error('Lỗi chi tiết:', err);
}

// Khởi tạo khi trang tải xong
document.addEventListener('DOMContentLoaded', () => {
    initGapiClient();
    initGisClient();
});

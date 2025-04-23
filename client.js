let localStream;
let socket;
let peers = {};
let localVideoEnabled = true;
let localAudioEnabled = true;

const configuration = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
    ]
};

async function joinRoom() {
    const username = document.getElementById('username').value;
    const roomName = document.getElementById('roomName').value;
    const roomPassword = document.getElementById('roomPassword').value;

    if (!username || !roomName || !roomPassword) {
        alert('Please fill in all fields');
        return;
    }

    try {
        localStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true
        });

        document.getElementById('localVideo').srcObject = localStream;
        document.getElementById('localUserName').textContent = username;
        
        document.getElementById('loginContainer').classList.add('hidden');
        document.getElementById('meetingContainer').classList.remove('hidden');

        // Connect to server
        socket = io('http://localhost:3000');

        socket.emit('join-room', { roomName, roomPassword, username });

        socket.on('user-connected', async (userId) => {
            const call = new RTCPeerConnection(configuration);
            peers[userId] = call;

            localStream.getTracks().forEach(track => {
                call.addTrack(track, localStream);
            });

            call.ontrack = event => {
                const video = document.createElement('video');
                video.id = `video-${userId}`;
                video.autoplay = true;
                video.srcObject = event.streams[0];
                
                const videoContainer = document.createElement('div');
                videoContainer.className = 'video-container';
                videoContainer.id = `container-${userId}`;
                
                const userName = document.createElement('div');
                userName.className = 'user-name';
                userName.textContent = userId;

                videoContainer.appendChild(video);
                videoContainer.appendChild(userName);
                document.getElementById('videoGrid').appendChild(videoContainer);
            };

            call.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('ice-candidate', { candidate: event.candidate, to: userId });
                }
            };

            const offer = await call.createOffer();
            await call.setLocalDescription(offer);
            socket.emit('offer', { offer, to: userId });
        });

        socket.on('offer', async ({ offer, from }) => {
            const call = new RTCPeerConnection(configuration);
            peers[from] = call;

            localStream.getTracks().forEach(track => {
                call.addTrack(track, localStream);
            });

            call.ontrack = event => {
                const video = document.createElement('video');
                video.id = `video-${from}`;
                video.autoplay = true;
                video.srcObject = event.streams[0];
                
                const videoContainer = document.createElement('div');
                videoContainer.className = 'video-container';
                videoContainer.id = `container-${from}`;
                
                const userName = document.createElement('div');
                userName.className = 'user-name';
                userName.textContent = from;

                videoContainer.appendChild(video);
                videoContainer.appendChild(userName);
                document.getElementById('videoGrid').appendChild(videoContainer);
            };

            call.onicecandidate = event => {
                if (event.candidate) {
                    socket.emit('ice-candidate', { candidate: event.candidate, to: from });
                }
            };

            await call.setRemoteDescription(offer);
            const answer = await call.createAnswer();
            await call.setLocalDescription(answer);
            socket.emit('answer', { answer, to: from });
        });

        socket.on('answer', async ({ answer, from }) => {
            await peers[from].setRemoteDescription(answer);
        });

        socket.on('ice-candidate', async ({ candidate, from }) => {
            await peers[from].addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on('user-disconnected', userId => {
            if (peers[userId]) {
                peers[userId].close();
                delete peers[userId];
            }
            const videoContainer = document.getElementById(`container-${userId}`);
            if (videoContainer) {
                videoContainer.remove();
            }
        });
    } catch (err) {
        console.error('Error:', err);
        alert('Error accessing camera/microphone');
    }
}

document.getElementById('toggleVideo').addEventListener('click', () => {
    localVideoEnabled = !localVideoEnabled;
    localStream.getVideoTracks().forEach(track => track.enabled = localVideoEnabled);
    document.getElementById('toggleVideo').innerHTML = 
        localVideoEnabled ? '<i class="fas fa-video"></i>' : '<i class="fas fa-video-slash"></i>';
});

document.getElementById('toggleAudio').addEventListener('click', () => {
    localAudioEnabled = !localAudioEnabled;
    localStream.getAudioTracks().forEach(track => track.enabled = localAudioEnabled);
    document.getElementById('toggleAudio').innerHTML = 
        localAudioEnabled ? '<i class="fas fa-microphone"></i>' : '<i class="fas fa-microphone-slash"></i>';
});

document.getElementById('leaveRoom').addEventListener('click', () => {
    if (socket) {
        socket.disconnect();
    }
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    Object.values(peers).forEach(peer => peer.close());
    peers = {};
    document.getElementById('meetingContainer').classList.add('hidden');
    document.getElementById('loginContainer').classList.remove('hidden');
    document.getElementById('videoGrid').innerHTML = '';
});
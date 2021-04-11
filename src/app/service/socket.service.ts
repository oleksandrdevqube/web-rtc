import {Injectable} from '@angular/core';
import {io} from 'socket.io-client';
import {BehaviorSubject} from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SocketService {

  public socket: any;
  public isRoomCreated = false;
  public iceServers = {
    iceServers: [
      {urls: 'stun:stun.l.google.com:19302'},
      {urls: 'stun:stun1.l.google.com:19302'},
      {urls: 'stun:stun2.l.google.com:19302'},
      {urls: 'stun:stun3.l.google.com:19302'},
      {urls: 'stun:stun4.l.google.com:19302'},
    ],
  };
  public room: string;
  public rtcPeerConnection: RTCPeerConnection;
  public localStream = new BehaviorSubject({});
  public remoteStream = new BehaviorSubject({});
  public sender: any;
  public share: boolean;

  constructor() {
    this.share = false;
  }

  setupSocketConncetion(): void {
    this.socket = io('http://localhost:3000');
  }

  joinRoom(room: string, share?: boolean): void {
    this.room = room;
    if (!share) {
      this.socket.on('room_created', async () => {
        console.log('Socket event callback: room_created');
        this.isRoomCreated = true;
      });

      this.socket.on('room_joined', async () => {
        console.log('Socket event callback: room_joined');

        this.socket.emit('start_call', room);
      });

      this.socket.on('full_room', () => {
        console.log('Socket event callback: full_room');

        alert('The room is full, please try another one');
      });
    } else {
      this.socket.emit('start_share', room);
    }

    this.socket.on('start_share', async (shared: any) => {
      console.log('Socket event callback: start_share');
      this.share = shared;
      this.socket.emit('start_call', room);
    });

    this.socket.on('start_call', async () => {
      console.log('Socket event callback: start_call');
      if (this.isRoomCreated && !this.share) {
        this.rtcPeerConnection = new RTCPeerConnection(this.iceServers);
        this.addLocalTracks(this.rtcPeerConnection, this.share);
        this.rtcPeerConnection.ontrack = this.setRemoteStream.bind(this);
        this.rtcPeerConnection.onicecandidate = this.sendIceCandidate.bind(this);
        await this.createOffer(this.rtcPeerConnection);
      } else {
        this.addLocalTracks(this.rtcPeerConnection, this.share);
      }
    });

    this.socket.on('webrtc_offer', async (event: any) => {
      console.log('Socket event callback: webrtc_offer');

      if (!this.isRoomCreated && !this.share) {
        this.rtcPeerConnection = new RTCPeerConnection(this.iceServers);
        this.addLocalTracks(this.rtcPeerConnection, this.share);
        this.rtcPeerConnection.ontrack = this.setRemoteStream.bind(this);
        this.rtcPeerConnection.onicecandidate = this.sendIceCandidate.bind(this);
        this.rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
        await this.createAnswer(this.rtcPeerConnection);
      } else {
        this.addLocalTracks(this.rtcPeerConnection, this.share);
      }
    });

    this.socket.on('webrtc_answer', (event: any) => {
      console.log('Socket event callback: webrtc_answer');
      this.rtcPeerConnection.setRemoteDescription(new RTCSessionDescription(event));
    });

    this.socket.on('webrtc_ice_candidate', (event: any) => {
      console.log('Socket event callback: webrtc_ice_candidate');

      const candidate = new RTCIceCandidate({
        sdpMLineIndex: event.label,
        candidate: event.candidate,
      });
      this.rtcPeerConnection.addIceCandidate(candidate);
    });
    if (!share) {
      this.socket.emit('join', room);
    }
  }

  setRemoteStream(event: any): void {
    this.remoteStream.next(event);
  }

  sendIceCandidate(event: any): void {
    if (event.candidate) {
      this.socket.emit('webrtc_ice_candidate', {
        roomId: this.room,
        label: event.candidate.sdpMLineIndex,
        candidate: event.candidate.candidate
      });
    }
  }

  stopStream(): void {
    this.socket.emit('leave', this.room);
    this.rtcPeerConnection.close();
  }

  async createAnswer(rtcPeerConnection: any): Promise<void> {
    let sessionDescription;
    try {
      sessionDescription = await rtcPeerConnection.createAnswer();
      rtcPeerConnection.setLocalDescription(sessionDescription);
    } catch (error) {
      console.error(error);
    }

    this.socket.emit('webrtc_answer', {
      type: 'webrtc_answer',
      sdp: sessionDescription,
      roomId: this.room,
    });
  }

  async createOffer(rtcPeerConnection: any): Promise<void> {
    let sessionDescription;
    try {
      sessionDescription = await rtcPeerConnection.createOffer();
      rtcPeerConnection.setLocalDescription(sessionDescription);
    } catch (error) {
      console.log(error);
    }

    this.socket.emit('webrtc_offer', {
      type: 'webrtc_offer',
      sdp: sessionDescription,
      roomId: this.room
    });
  }

  addLocalTracks(rtcPeerConnection: any, share: any): any {
    if (!share) {
      this.getValue().getTracks().forEach((track: any) => {
        this.sender = rtcPeerConnection.addTrack(track, this.getValue());
      });
    } else {
      this.getValue().getTracks().forEach((track: any) => {
        rtcPeerConnection.getSenders().forEach((a: any) => {
          a.replaceTrack(track);
        });
      });
    }
  }

  setValue(value: any): void {
    this.localStream.next(value);
  }

  getValue(): any {
    return this.localStream.value;
  }
}

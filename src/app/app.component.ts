import {AfterViewInit, Component, ElementRef, OnInit, ViewChild} from '@angular/core';
import set = Reflect.set;
import {SocketService} from './service/socket.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit, AfterViewInit {
  public navigator: any = navigator as any;
  public localStream: MediaStream;
  public remoteStream: MediaStream;
  public roomId: string;
  public fullWidth: boolean;
  public mediaRecorder: MediaRecorder;
  public recordedBlobs: Blob[];
  public downloadUrl: string;
  public recordVideoElement: any;

  constructor(public socketService: SocketService) {
    this.fullWidth = false;
  }

  ngOnInit(): void {
  }

  ngAfterViewInit(): void {
    this.socketService.setupSocketConncetion();
    const video = document.getElementById('video');
    this.navigator.getUserMedia = (this.navigator.getUserMedia || this.navigator.webkitGetUserMedia || this.navigator.mozGetUserMedia || this.navigator.msGetUserMedia);
    this.navigator.mediaDevices.getUserMedia({video: true, audio: true})
      .then((stream: MediaStream) => {
        this.localStream = stream;
        // @ts-ignore
        video.srcObject = stream;
        this.socketService.setValue(stream);
      });
    this.socketService.remoteStream.subscribe((remote: any) => {
      if (remote.streams) {
        const remoteVideo = document.getElementById('videoRemote');
        this.remoteStream = remote.streams[0];
        // @ts-ignore
        remoteVideo.srcObject = remote.streams[0];
      }
    });
  }

  connectRoom(id: string): void {
    if (id === '') {
      return;
    }
    this.roomId = id;
    this.socketService.joinRoom(this.roomId);
  }

  startShareMonitor(): void {
    const video = document.getElementById('video');
    this.navigator.mediaDevices.getDisplayMedia({video: true}).then((stream: any) => {
      // @ts-ignore
      video.srcObject = stream;
      this.localStream = stream;
      this.socketService.setValue(stream);
      this.socketService.joinRoom(this.roomId, true);
    });
  }

  stopStream(): void {
    this.socketService.stopStream();
  }

  startRecord(): void {
    this.startRecording(this.localStream);
  }

  startRecording(stream: MediaStream): void {
    this.recordVideoElement = document.getElementById('videoRecord');
    const options = {mimeType: 'video/webm'};
    this.recordedBlobs = [];
    try {
      this.mediaRecorder = new MediaRecorder(stream, options);
    } catch (e0) {
      console.log('Try different mimeType');
    }
    this.mediaRecorder.onstop = this.handleStop.bind(this);
    this.mediaRecorder.ondataavailable = this.handleDataAvailable.bind(this);
    this.mediaRecorder.start(100);
  }

  handleDataAvailable(event: any): void {
    if (event.data && event.data.size > 0) {
      this.recordedBlobs.push(event.data);
    }
  }

  handleStop(event: any): void {
    console.log('Recorder stopped: ', event);
    const videoBuffer = new Blob(this.recordedBlobs, {type: 'video/webm'});
    this.downloadUrl = window.URL.createObjectURL(videoBuffer);
    this.recordVideoElement.src = this.downloadUrl;
  }

  download(): void {
    window.open(this.downloadUrl);
  }

  stopRecording(): void {
    this.mediaRecorder.stop();
    this.recordVideoElement.controls = true;
  }

  playRecording(): void {
    if (!this.recordedBlobs.length) {
      console.log('cannot play.');
      return;
    }
    this.recordVideoElement.play();
  }
}

import 'webrtc-adapter';
import { Mitt } from './mitt';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun.stunprotocol.org:3478' },
  { urls: 'stun:stun.sipnet.net:3478' },
  { urls: 'stun:stun.ideasip.com:3478' },
  { urls: 'stun:stun.iptel.org:3478' },
  {
    url: 'stun:global.stun.twilio.com:3478?transport=udp',
    urls: 'stun:global.stun.twilio.com:3478?transport=udp',
  },
  {
    urls: [
      'turn:173.194.72.127:19305?transport=udp',
      'turn:[2404:6800:4008:C01::7F]:19305?transport=udp',
      'turn:173.194.72.127:443?transport=tcp',
      'turn:[2404:6800:4008:C01::7F]:443?transport=tcp',
    ],
    username: 'CKjCuLwFEgahxNRjuTAYzc/s6OMT',
    credential: 'u1SQDR/SQsPQIxXNWQT7czc/G4c=',
  },
];

export class Peer extends Mitt {
  // ===== Perfect negotiation Peer =====
  // https://w3c.github.io/webrtc-pc/#perfect-negotiation-example
  // https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API/Perfect_negotiation

  constructor(peerUid, polite, socket) {
    super();
    this.pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });
    this.socket = socket;
    this.peerUid = peerUid;
    this.polite = polite;

    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;

    this.initPeerConnectionListeners();
  }

  initPeerConnectionListeners() {
    this.pc.onicegatheringstatechange = () => {
      //console.log(`ICE gathering state changed: ${this.pc.iceGatheringState}`);
    };
    this.pc.onsignalingstatechange = () => {
      //console.log(`Signaling state change: ${this.pc.signalingState}`);
    };
    this.pc.oniceconnectionstatechange = () => {
      //console.log(`ICE connection state change: ${this.pc.iceConnectionState}`);
      if (this.pc.iceConnectionState === 'failed') {
        this.pc.restartIce();
      }
    };
    this.pc.onicecandidate = (event) => {
      console.info(`[${this.peerUid}] send ice candidate`);
      if (event.candidate) {
        this.socket.emit('relayICECandidate', {
          peerUid: this.peerUid,
          iceCandidate: event.candidate.toJSON(),
        });
      }
    };
    this.pc.onconnectionstatechange = () => {
      const connectionState = this.pc.connectionState;
      console.log(`Connection state change: ${connectionState}`);
      this.emit('connectionStateChange', connectionState);
    };

    // Listen for remote track
    this.pc.ontrack = (event) => {
      console.info(`[${this.peerUid}] inbound stream received`);
      const { track, streams } = event;
      track.onunmute = () => {
        this.emit('stream', streams[0]);
      };
    };

    this.pc.onnegotiationneeded = async () => {
      console.info(`[${this.peerUid}] negotiation needed`);
      try {
        this.makingOffer = true;
        await this.pc.setLocalDescription();
        console.info(`[${this.peerUid}] send session description offer`);
        this.socket.emit('relaySessionDescription', {
          peerUid: this.peerUid,
          sessionDescription: this.pc.localDescription.toJSON(),
        });
      } catch (err) {
        console.error(err);
      } finally {
        this.makingOffer = false;
      }
    };
  }

  updateSocket(socket) {
    this.socket = socket;
  }

  async processDescription(description) {
    // An offer may come in while we are busy processing SRD(answer).
    // In this case, we will be in "stable" by the time the offer is processed
    // so it is safe to chain it on our Operations Chain now.
    const readyForOffer =
      !this.makingOffer &&
      (this.pc.signalingState === 'stable' ||
        this.isSettingRemoteAnswerPending);
    const offerCollision = description.type === 'offer' && !readyForOffer;

    this.ignoreOffer = !this.polite && offerCollision;
    if (this.ignoreOffer) {
      console.info(`[${this.peerUid}] offer ignored`);
      return;
    }
    this.isSettingRemoteAnswerPending = description.type === 'answer';
    await this.pc.setRemoteDescription(description); // SRD rolls back as needed
    this.pc.isSettingRemoteAnswerPending = false;
    if (description.type === 'offer') {
      await this.pc.setLocalDescription();
      console.info(`[${this.peerUid}] send session description answer`);
      this.socket.emit('relaySessionDescription', {
        peerUid: this.peerUid,
        sessionDescription: this.pc.localDescription.toJSON(),
      });
    }
  }

  async processCandidate(candidate) {
    try {
      await this.pc.addIceCandidate(candidate);
    } catch (err) {
      if (!this.ignoreOffer) throw err; // Suppress ignored offer's candidates
    }
  }

  destroy() {
    try {
      this.pc.close();
    } catch (e) {}
  }
}

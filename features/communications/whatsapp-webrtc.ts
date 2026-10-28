/** Minimal WebRTC helpers for Meta WhatsApp Cloud API Calling (OPUS audio). */

export type SoftphoneSession = {
  pc: RTCPeerConnection;
  localStream: MediaStream;
  remoteAudio: HTMLAudioElement;
};

export async function createSoftphone(): Promise<SoftphoneSession> {
  const localStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  });
  for (const track of localStream.getTracks()) {
    pc.addTrack(track, localStream);
  }
  const remoteAudio = document.createElement("audio");
  remoteAudio.autoplay = true;
  remoteAudio.setAttribute("playsinline", "true");
  pc.ontrack = (ev) => {
    const [stream] = ev.streams;
    if (stream) remoteAudio.srcObject = stream;
  };
  return { pc, localStream, remoteAudio };
}

export async function createOfferSdp(pc: RTCPeerConnection): Promise<string> {
  const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: false });
  await pc.setLocalDescription(offer);
  await waitForIceGathering(pc);
  return pc.localDescription?.sdp ?? offer.sdp ?? "";
}

export async function createAnswerSdp(pc: RTCPeerConnection, remoteOfferSdp: string): Promise<string> {
  await pc.setRemoteDescription({ type: "offer", sdp: remoteOfferSdp });
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  await waitForIceGathering(pc);
  return pc.localDescription?.sdp ?? answer.sdp ?? "";
}

export async function applyRemoteAnswer(pc: RTCPeerConnection, answerSdp: string): Promise<void> {
  await pc.setRemoteDescription({ type: "answer", sdp: answerSdp });
}

export function destroySoftphone(session: SoftphoneSession | null): void {
  if (!session) return;
  for (const track of session.localStream.getTracks()) track.stop();
  session.pc.close();
  session.remoteAudio.srcObject = null;
  session.remoteAudio.remove();
}

function waitForIceGathering(pc: RTCPeerConnection, timeoutMs = 2500): Promise<void> {
  if (pc.iceGatheringState === "complete") return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      pc.removeEventListener("icegatheringstatechange", onChange);
      window.clearTimeout(timer);
      resolve();
    };
    const onChange = () => {
      if (pc.iceGatheringState === "complete") done();
    };
    const timer = window.setTimeout(done, timeoutMs);
    pc.addEventListener("icegatheringstatechange", onChange);
  });
}

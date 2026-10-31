import {cameraProfile} from './camera-model';
export const MIN_CAPTURE_MPH=30, MAX_CAPTURE_MPH=40;
/** Scenario assumption, not an aircraft stall-speed or payload certification. */
export function captureSpeed(spacingM:number,shots=4){
 const seconds=shots*(cameraProfile.retargetSeconds+cameraProfile.focusSeconds+2)+4;
 const idealMph=Math.max(0,spacingM)/seconds/.44704;
 return {mph:Math.max(MIN_CAPTURE_MPH,Math.min(MAX_CAPTURE_MPH,idealMph)),seconds,requiresAnotherPass:idealMph<MIN_CAPTURE_MPH};
}
export function catchupSpeed(planned:number,forwardM:number,remainingSeconds:number){
 return Math.max(MIN_CAPTURE_MPH,Math.min(planned,Math.max(0,forwardM-30)/Math.max(1,remainingSeconds)/.44704));
}

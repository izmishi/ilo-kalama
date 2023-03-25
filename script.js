var noteKeyDown = [false, false, false, false];

const middleC = 440 / Math.pow(2, 0.75);
const majorScaleSteps = [0, 2, 4, 5, 7, 9, 11];
const minRampTime = 0.01;
var currentOctave = 0;

var leftHanded = false;

var baseAmplitude = 0;
var baseFrequency = middleC;

var audioContext;
var oscillator;
var oscillatorAmplitudeNode;
var mixerNode;


function setAudioParameter(parameter, value, rampDuration = minRampTime) {
    parameter.cancelAndHoldAtTime(audioContext.currentTime)
    parameter.setValueAtTime(oscillatorAmplitudeNode.gain.value, audioContext.currentTime);
    parameter.linearRampToValueAtTime(value, audioContext.currentTime + rampDuration);
}

function equalLoudnessCorrection(frequency) {
    return 2500 * (Math.pow(frequency, -1.5) + Math.pow(frequency, -1.4))
}



function updateFrequency() {
    const scaleDegree = 4 * noteKeyDown[0] + 2 * noteKeyDown[1] + noteKeyDown[2]
    if (scaleDegree > 0) {
        baseAmplitude = 2;
        baseFrequency = middleC * Math.pow(2, majorScaleSteps[scaleDegree - 1] / 12);

        if (noteKeyDown[3]) {
            // Sharp key held down
            baseFrequency *= Math.pow(2, 1 / 12);
        }

        baseFrequency *= Math.pow(2, currentOctave);

        setAudioParameter(oscillatorAmplitudeNode.gain, baseAmplitude * equalLoudnessCorrection(baseFrequency))
    } else {
        baseAmplitude = 0;
    }
}

function updateAmplitude() {
    const scaleDegree = 4 * noteKeyDown[0] + 2 * noteKeyDown[1] + noteKeyDown[2]
    if (scaleDegree == 0) {
        setAudioParameter(oscillatorAmplitudeNode.gain, 0)
    }
}



function noteKeyTouchStart(finger) {
    const oscillatorAmplitudeIs0 = (noteKeyDown[0] + noteKeyDown[1] + noteKeyDown[2]) == 0
    noteKeyDown[finger] = true;
    updateFrequency();

    if (oscillatorAmplitudeIs0) {
        setAudioParameter(oscillatorAmplitudeNode.gain, baseAmplitude * equalLoudnessCorrection(baseFrequency))
    }
}

function noteKeyTouchEnd(finger) {
    noteKeyDown[finger] = false;
    updateFrequency();
    updateAmplitude();
}

function octaveKeyTouchMove(event) {
    const octaveTouches = Object.entries(event.touches).filter(t => t[1].target.className.startsWith("octave-key"))
    if (octaveTouches.length == 0) {
        currentOctave = 0;
    } else {
        const touch = octaveTouches[octaveTouches.length - 1][1];
        var x = touch.pageX;
        var y = touch.pageY;

        const touchTarget = touch.target;
        const currentElement = document.elementFromPoint(x, y);

        if (touchTarget.className == currentElement.className) {
            octave = currentElement.id.substring(6)
            currentOctave = parseInt(octave);
        }   
    }   
    updateFrequency();  
}

function setUpAudioContext() {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    oscillator = audioContext.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = 440 / Math.pow(2, 0.75); // hertz

    oscillatorAmplitudeNode = audioContext.createGain();
    oscillatorAmplitudeNode.gain.setValueAtTime(0, audioContext.currentTime); 

    mixerNode = audioContext.createGain();
    mixerNode.gain.setValueAtTime(1, audioContext.currentTime); 

    oscillator.connect(oscillatorAmplitudeNode);
    oscillatorAmplitudeNode.connect(mixerNode);
    mixerNode.connect(audioContext.destination);
}

function startOscillator() {
    setUpAudioContext()
    oscillator.start();
    requestMotionPermission();
    document.getElementById("overlay").style.display = "none";
}

function updateLoop(vibrato, volume) {
    oscillator.frequency.value = baseFrequency * vibrato;
    mixerNode.gain.linearRampToValueAtTime(volume, audioContext.currentTime + 1/60);
}

function requestMotionPermission() {
    if (typeof DeviceMotionEvent.requestPermission === 'function') {
        DeviceMotionEvent.requestPermission()
            .then(response => {
                if (response == 'granted') {
                    window.addEventListener('devicemotion', handleMotionEvent)
                }
            })
            .catch(function() {
                console.log("Failed to request permission");
            });
    } else {
        window.addEventListener('devicemotion', handleMotionEvent)
    }
}

function vibratoFromAcelerometer(y) {
    return Math.pow(2, y / 12);
}

function volumeFromAccelerometer(x) {
    const sign = leftHanded ? -1 : 1;
    const scaledX = Math.min(Math.max(x * -1.4, -1), 1) * sign;
    const angle = 2 * Math.acos(scaledX) / Math.PI;
    const vol = (Math.pow(4, 1.5 * angle) - 1) / 4;
    return Math.max(vol, 0)
}

function handleMotionEvent(event) {
    const gravityX = event.accelerationIncludingGravity.x / 9.8;
    const gravityY = event.accelerationIncludingGravity.y / 9.8;
    const gravityZ = event.accelerationIncludingGravity.z / 9.8;
    const x = event.acceleration.x / 9.8;
    const y = event.acceleration.y / 9.8;
    const z = event.acceleration.z / 9.8;

    const vibrato = vibratoFromAcelerometer(y);
    const volume = volumeFromAccelerometer(gravityX);
    updateLoop(vibrato, volume)
}


const overlay = document.getElementById("overlay");

if (navigator.maxTouchPoints >= 4) {
    // Supports at least 4 multi-touch points
    overlay.addEventListener("click", startOscillator);
} else {
    overlay.innerHTML = "Please use a device which supports at least 4 multi-touch points";
}


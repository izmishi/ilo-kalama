var noteKeyDown = [false, false, false, false];

const middleC = 440 / Math.pow(2, 0.75);
const majorScaleSteps = [0, 2, 4, 5, 7, 9, 11];
var currentOctave = 0;

var baseAmplitude = 2;

function updateFrequency() {
    const scaleDegree = 4 * noteKeyDown[0] + 2 * noteKeyDown[1] + noteKeyDown[2]
    if (scaleDegree > 0) {
        baseAmplitude = 2;
        var baseFrequency = middleC * Math.pow(2, majorScaleSteps[scaleDegree - 1] / 12);

        if (noteKeyDown[3]) {
            // Sharp key held down
            baseFrequency *= Math.pow(2, 1 / 12);
        }

        baseFrequency *= Math.pow(2, currentOctave);

        oscillator.frequency.value = baseFrequency; // hertz

        gainNode.gain.value = baseAmplitude * equalLoudnessCorrection(baseFrequency);
    } else {
        baseAmplitude = 0.0001;
    }
}

function updateAmplitude() {
    const scaleDegree = 4 * noteKeyDown[0] + 2 * noteKeyDown[1] + noteKeyDown[2]
    if (scaleDegree == 0) {
        gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime); 
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.03);
    }
}

function noteKeyTouchStart(finger) {
    noteKeyDown[finger] = true;
    updateFrequency();

    gainNode.gain.setValueAtTime(gainNode.gain.value, audioContext.currentTime); 
    gainNode.gain.exponentialRampToValueAtTime(baseAmplitude * equalLoudnessCorrection(oscillator.frequency.value), audioContext.currentTime + 0.03);
    // oscillator.start();
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

function equalLoudnessCorrection(frequency) {
    return 2500 * (Math.pow(frequency, -1.5) + Math.pow(frequency, -1.4))
}

const audioContext = new (window.AudioContext || window.webkitAudioContext)();

const oscillator = audioContext.createOscillator();
oscillator.type = 'sine';
oscillator.frequency.value = 440 / Math.pow(2, 0.75); // hertz

const gainNode = audioContext.createGain();
gainNode.gain.value = 0;

oscillator.connect(gainNode);
gainNode.connect(audioContext.destination);

function startOscillator() {
    oscillator.start();
    document.getElementById("overlay").style.display = "none";
}

document.addEventListener("DOMContentLoaded", startup);
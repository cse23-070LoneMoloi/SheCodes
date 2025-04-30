// Initialize PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

// DOM Elements
const bgColor = document.getElementById("bgColor");
const fontSize = document.getElementById("fontSize");
const lineSpacing = document.getElementById("lineSpacing");
const inputText = document.getElementById("inputText");
const outputText = document.getElementById("outputText");
const voiceSelect = document.getElementById("voiceSelect");
const fileUpload = document.getElementById('fileUpload');
const processingProgress = document.getElementById('processingProgress');
const imageBtn = document.getElementById('imageBtn');
const pdfBtn = document.getElementById('pdfBtn');
const speechSpeed = document.getElementById('speechSpeed');

// State variables
let currentUploadType = 'image';
let currentPdf = null;
let totalPages = 0;
let currentSpeed = 1;

// Load available voices when the page loads
window.addEventListener('load', () => {
  populateVoiceList();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = populateVoiceList;
  }
});

function populateVoiceList() {
  const voices = speechSynthesis.getVoices();
  voiceSelect.innerHTML = '<option value="">Select Voice</option>';
  
  voices.forEach(voice => {
    const option = document.createElement('option');
    option.textContent = `${voice.name} (${voice.lang})`;
    option.setAttribute('data-lang', voice.lang);
    option.setAttribute('data-name', voice.name);
    voiceSelect.appendChild(option);
  });
}

// Event Listeners
bgColor.addEventListener("input", () => {
  outputText.style.backgroundColor = bgColor.value;
});

fontSize.addEventListener("input", () => {
  outputText.style.fontSize = fontSize.value + "px";
});

lineSpacing.addEventListener("input", () => {
  const spacing = lineSpacing.value;
  inputText.style.lineHeight = spacing;
  outputText.style.lineHeight = spacing;
});

inputText.addEventListener("input", () => {
  outputText.textContent = inputText.value;
});

// Functions
function speakText() {
  const text = inputText.value.trim();
  if (!text || !('speechSynthesis' in window)) {
    alert("Sorry, your browser doesn't support text-to-speech.");
    return;
  }

  const selectedOption = voiceSelect.selectedOptions[0].getAttribute('data-name');
  const voices = speechSynthesis.getVoices();
  const selectedVoice = voices.find(voice => voice.name === selectedOption);

  const words = text.split(/\s+/);
  const chunkSize = 4;
  const chunks = [];

  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(' '));
  }

  let i = 0;

  function speakNextChunk() {
    if (i >= chunks.length) {
      outputText.innerHTML = text;
      return;
    }

    const currentChunk = chunks[i];

    outputText.innerHTML = chunks
      .map((chunk, index) => index === i ? `<mark>${chunk}</mark>` : chunk)
      .join(' ');

    const utterance = new SpeechSynthesisUtterance(currentChunk);
    utterance.lang = 'en-US';
    utterance.rate = currentSpeed;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    utterance.onend = () => {
      i++;
      speakNextChunk();
    };

    window.speechSynthesis.speak(utterance);
  }

  window.speechSynthesis.cancel();
  speakNextChunk();
}

function toggleHighContrast() {
  document.body.classList.toggle("high-contrast");
}

function toggleDarkMode() {
  document.body.classList.toggle("dark-mode");
}

function stopSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    outputText.innerHTML = inputText.value;
  }
}

function switchUploadType(type) {
  currentUploadType = type;
  fileUpload.accept = type === 'image' ? 'image/*' : '.pdf';
  
  // Update button styles
  imageBtn.classList.toggle('active', type === 'image');
  pdfBtn.classList.toggle('active', type === 'pdf');
}

fileUpload.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  // Show progress
  processingProgress.style.display = 'block';
  processingProgress.textContent = 'Processing file...';

  try {
    if (currentUploadType === 'image') {
      await processImage(file);
    } else {
      await processPDF(file);
    }
  } catch (error) {
    console.error('Processing Error:', error);
    processingProgress.textContent = 'Error processing file. Please try again.';
  }
});

async function processImage(file) {
  // Process with Tesseract.js
  const { data: { text } } = await Tesseract.recognize(
    file,
    'eng',
    {
      logger: m => {
        if (m.status === 'recognizing text') {
          processingProgress.textContent = `Processing: ${Math.round(m.progress * 100)}%`;
        }
      }
    }
  );

  updateTextAndSpeak(text);
}

async function processPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  currentPdf = await pdfjsLib.getDocument(arrayBuffer).promise;
  totalPages = currentPdf.numPages;
  
  // Extract text from all pages
  let fullText = '';
  for (let i = 1; i <= totalPages; i++) {
    processingProgress.textContent = `Extracting text from page ${i} of ${totalPages}...`;
    const page = await currentPdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items.map(item => item.str).join(' ');
    fullText += pageText + '\n\n';
  }
  
  // Update text and hide progress
  updateTextAndSpeak(fullText);
}

function updateTextAndSpeak(text) {
  // Update input text with extracted text
  inputText.value = text;
  outputText.textContent = text;
  
  // Hide progress
  processingProgress.style.display = 'none';
  
  // Speak the extracted text
  speakText();
}

// Add speech speed event listener
speechSpeed.addEventListener("input", () => {
  currentSpeed = parseFloat(speechSpeed.value);
  // Update the speech if it's currently playing
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    speakText();
  }
}); 
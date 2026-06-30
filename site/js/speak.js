(function (global) {
  const LANG = 'el-GR';

  let greekVoice = null;

  function getSynth() {
    return global.speechSynthesis ?? null;
  }

  function isSupported() {
    return typeof global.SpeechSynthesisUtterance !== 'undefined' && !!getSynth();
  }

  function pickGreekVoice(voices) {
    return (
      voices.find((v) => v.lang === 'el-GR') ||
      voices.find((v) => v.lang.startsWith('el-')) ||
      voices.find((v) => v.lang.startsWith('el')) ||
      null
    );
  }

  function loadVoices() {
    const synth = getSynth();
    if (!synth) return;
    const voices = synth.getVoices();
    if (voices.length) greekVoice = pickGreekVoice(voices);
  }

  if (isSupported()) {
    loadVoices();
    getSynth().addEventListener('voiceschanged', loadVoices);
  }

  function normalizeLines(text) {
    const lines = Array.isArray(text) ? text : [text];
    return lines.map((l) => String(l).trim()).filter(Boolean);
  }

  /**
   * Озвучить греческий текст. Несколько строк — по очереди.
   * @returns {Promise<boolean>} false если TTS недоступен или ошибка
   */
  function speakGreek(text) {
    const lines = normalizeLines(text);
    if (!lines.length || !isSupported()) return Promise.resolve(false);

    const synth = getSynth();
    synth.cancel();
    if (!greekVoice) loadVoices();

    return new Promise((resolve) => {
      let index = 0;

      function speakNext() {
        if (index >= lines.length) {
          resolve(true);
          return;
        }

        const utterance = new SpeechSynthesisUtterance(lines[index]);
        utterance.lang = LANG;
        if (greekVoice) utterance.voice = greekVoice;

        utterance.onend = () => {
          index += 1;
          speakNext();
        };
        utterance.onerror = () => resolve(false);

        synth.speak(utterance);
      }

      speakNext();
    });
  }

  function stop() {
    getSynth()?.cancel();
  }

  function isSpeaking() {
    return !!getSynth()?.speaking;
  }

  global.GreekSpeak = {
    isSupported,
    hasGreekVoice() {
      if (!greekVoice) loadVoices();
      return !!greekVoice;
    },
    speakGreek,
    stop,
    isSpeaking,
  };
})(window);

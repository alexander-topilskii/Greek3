(function (global) {
  const LANG = 'el-GR';

  let greekVoice = null;
  let speakSession = 0;

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

  /** Chrome/Safari: голоса часто появляются только после жеста пользователя. */
  function prepareSynth() {
    const synth = getSynth();
    if (!synth) return;
    synth.resume();
    loadVoices();
  }

  if (isSupported()) {
    loadVoices();
    getSynth().addEventListener('voiceschanged', loadVoices);
  }

  function normalizeLines(text) {
    const lines = Array.isArray(text) ? text : [text];
    return lines.map((l) => String(l).trim()).filter(Boolean);
  }

  function isIgnorableError(error) {
    return error === 'interrupted' || error === 'canceled';
  }

  /**
   * Озвучить греческий текст. Несколько строк — по очереди.
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  function speakGreek(text) {
    const lines = normalizeLines(text);
    if (!lines.length || !isSupported()) {
      return Promise.resolve({ ok: false, reason: 'unsupported' });
    }

    const synth = getSynth();
    const session = ++speakSession;
    prepareSynth();

    if (synth.speaking || synth.pending) synth.cancel();

    return new Promise((resolve) => {
      let index = 0;
      let settled = false;
      let watchdog = null;

      function clearWatchdog() {
        if (watchdog) {
          global.clearTimeout(watchdog);
          watchdog = null;
        }
      }

      function finish(ok, reason) {
        if (settled || session !== speakSession) return;
        settled = true;
        clearWatchdog();
        resolve({ ok, reason });
      }

      function armWatchdog() {
        clearWatchdog();
        watchdog = global.setTimeout(() => {
          if (session !== speakSession || settled) return;
          finish(false, 'timeout');
        }, 8000);
      }

      function speakNext() {
        if (session !== speakSession) return;

        if (index >= lines.length) {
          finish(true);
          return;
        }

        const line = lines[index];
        const utterance = new SpeechSynthesisUtterance(line);
        utterance.lang = LANG;
        if (greekVoice) utterance.voice = greekVoice;

        let started = false;
        armWatchdog();

        utterance.onstart = () => {
          started = true;
        };

        utterance.onend = () => {
          if (session !== speakSession) return;
          index += 1;
          speakNext();
        };

        utterance.onerror = (e) => {
          if (session !== speakSession) return;
          const err = e?.error ?? 'unknown';
          if (isIgnorableError(err)) return;
          finish(false, err);
        };

        synth.speak(utterance);

        // Chrome: очередь иногда «зависает» без resume или повторного speak.
        global.setTimeout(() => {
          if (session !== speakSession || settled || started) return;
          if (synth.paused) synth.resume();
          if (!synth.speaking && !synth.pending) {
            synth.speak(utterance);
          }
        }, 120);
      }

      // Отложенный старт: cancel() и speak() в одном тике ломают Chrome.
      global.setTimeout(speakNext, 0);
    });
  }

  function stop() {
    speakSession += 1;
    getSynth()?.cancel();
  }

  function isSpeaking() {
    return !!getSynth()?.speaking;
  }

  global.GreekSpeak = {
    isSupported,
    hasGreekVoice() {
      prepareSynth();
      return !!greekVoice;
    },
    speakGreek,
    stop,
    isSpeaking,
  };
})(window);

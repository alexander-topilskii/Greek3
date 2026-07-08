(function (global) {
  function greekSummaryLines(word) {
    if (word.baseForms?.length) return word.baseForms;
    if (word.forms?.length) return word.forms.slice(0, 3).map((f) => f.greek);
    return [];
  }

  function resolveDirection(pick, practiceDirection) {
    return practiceDirection ?? pick.direction ?? 'el-ru';
  }

  function showSummaryCard(fc, pick, direction) {
    const word = pick.word;
    const greekLines = greekSummaryLines(word);
    fc.startWithRussian = direction === 'ru-el';
    if (direction === 'ru-el') {
      fc.showMultiLine([word.translation], greekLines, false, true);
    } else {
      fc.showMultiLine(greekLines, [word.translation], true, false);
    }
  }

  /**
   * @param {object} fc - flashcard instance
   * @param {object} pick
   * @param {{ practiceDirection?: string|null, supportsForms?: boolean }} [options]
   */
  function showCardContent(fc, pick, options = {}) {
    if (!fc || !pick) return;
    const direction = resolveDirection(pick, options.practiceDirection);
    const word = pick.word;

    if (pick.type === 'summary' || pick.isNew || (pick.card && pick.card.type === 'summary')) {
      showSummaryCard(fc, pick, direction);
      return;
    }

    if (options.supportsForms) {
      const formIndex = pick.formIndex ?? pick.card?.formIndex ?? 0;
      const form = word.forms?.[formIndex];
      if (form) {
        fc.showPair(form.greek, form.translation);
        return;
      }
    }

    showSummaryCard(fc, pick, direction);
  }

  async function ensurePickCard(pick, db, options = {}) {
    const globalDeckId = options.globalDeckId ?? db.GLOBAL_DECK_ID ?? 'global';
    const direction = resolveDirection(pick, options.practiceDirection);

    if (pick.isNew) {
      return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary', null, direction), {
        deckId: globalDeckId,
        wordSlug: pick.word.slug,
        type: 'summary',
        direction,
      });
    }
    if (pick.card) return pick.card;
    if (pick.type === 'summary' || !options.supportsForms) {
      return db.getOrCreateCard(db.cardId(pick.word.slug, 'summary', null, direction), {
        deckId: globalDeckId,
        wordSlug: pick.word.slug,
        type: 'summary',
        direction,
      });
    }
    const idx = pick.formIndex ?? 0;
    return db.getOrCreateCard(db.cardId(pick.word.slug, 'form', idx, direction), {
      deckId: globalDeckId,
      wordSlug: pick.word.slug,
      type: 'form',
      formIndex: idx,
      direction,
    });
  }

  /**
   * @param {object} params
   * @param {object} params.currentPick
   * @param {object} params.db
   * @param {object} params.srs
   * @param {string} params.deckId
   * @param {object} params.catalog
   * @param {() => Promise<object[]>} params.getCards
   * @param {boolean} params.remembered
   * @param {string|null} [params.practiceDirection]
   * @param {boolean} [params.supportsForms]
   */
  async function gradeCurrentWithPoolExpand(params) {
    const {
      currentPick,
      db,
      srs,
      deckId,
      catalog,
      getCards,
      remembered,
      practiceDirection = null,
      supportsForms = false,
    } = params;
    if (!currentPick) return;

    const slug = currentPick.word.slug;
    const direction = resolveDirection(currentPick, practiceDirection);
    const cardsBefore = await getCards();
    const wasDone = srs.isWordDoneForPool(slug, cardsBefore, db);

    const card = await ensurePickCard(currentPick, db, {
      globalDeckId: db.GLOBAL_DECK_ID ?? 'global',
      practiceDirection,
      supportsForms,
    });
    await db.putCard(srs.gradeCard(card, remembered));
    await db.flushBackup();
    if (remembered) {
      srs.recordSessionCorrect(slug, direction);
    }

    if (remembered && !wasDone) {
      const cardsAfter = await getCards();
      const settings = await srs.loadDeckSettings(deckId, db);
      const hadProgress = cardsBefore.some(
        (c) =>
          c.wordSlug === slug &&
          c.type === 'summary' &&
          ((c.repetitions ?? 0) > 0 || (c.remembered ?? 0) > 0),
      );
      if (!hadProgress) {
        await srs.expandPoolOnFirstTouch(deckId, catalog, db, settings, slug, cardsBefore);
      }
      if (srs.isWordDoneForPool(slug, cardsAfter, db)) {
        await srs.expandPoolOnWordLearned(deckId, catalog, db, settings);
      }
    }
  }

  global.GreekPracticeCommon = {
    greekSummaryLines,
    showSummaryCard,
    showCardContent,
    ensurePickCard,
    gradeCurrentWithPoolExpand,
  };
})(window);

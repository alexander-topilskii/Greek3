export type PronounCase = 'nominative' | 'accusative' | 'genitive';

export interface PronounCell {
  personLabel: string;
  greek: string;
  ru: string;
  slug?: string;
  hint?: string;
}

export interface PronounRow {
  left: PronounCell;
  right: PronounCell;
}

export interface PronounFace {
  case: PronounCase;
  title: string;
  subtitle: string;
  colLeftTitle: string;
  colRightTitle: string;
  rows: PronounRow[];
}

export interface PronounVariant {
  id: string;
  label: string;
  faces: Record<PronounCase, PronounFace>;
  extraNotes?: {
    title: string;
    description?: string;
    examples: { greek: string; ru: string }[];
  };
}

export interface PronounParadigm {
  id: string;
  title: string;
  tabLabel: string;
  variants: PronounVariant[];
  defaultCase?: PronounCase;
  defaultVariant?: string;
}

export const PERSONAL_PARADIGM: PronounParadigm = {
  id: 'personal',
  title: 'Личные местоимения',
  tabLabel: 'Личные (εγώ, με, μου)',
  defaultCase: 'accusative',
  defaultVariant: 'weak',
  variants: [
    {
      id: 'weak',
      label: 'Слабые (клитики)',
      extraNotes: {
        title: 'Употребление слабых форм (клитик)',
        description: 'Безударные краткие местоимения. Ставятся перед спрягаемым глаголом (или после повелительного/деепричастия).',
        examples: [
          { greek: 'Ο Νίκος με βλέπει.', ru: 'Никос видит меня (прямой объект — вин. пад.).' },
          { greek: 'Μου δίνει το βιβλίο.', ru: 'Он даёт мне книгу (косвенный объект — род. пад.).' },
          { greek: 'Το σπίτι μου είναι κοντά.', ru: 'Мой дом рядом (притяжание — род. пад. после сущ.).' },
          { greek: 'Πες μου την αλήθεια!', ru: 'Скажи мне правду! (после глагола в повелительном).' },
        ],
      },
      faces: {
        nominative: {
          case: 'nominative',
          title: 'Именительный падеж',
          subtitle: 'Ονομαστική — кто? что? (подлежащее)',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (я)', greek: 'εγώ', ru: 'я', slug: 'pronouns/я εγώ' },
              right: { personLabel: '1 л. (мы)', greek: 'εμείς', ru: 'мы', slug: 'pronouns/мы εμείς' },
            },
            {
              left: { personLabel: '2 л. (ты)', greek: 'εσύ', ru: 'ты', slug: 'pronouns/ты εσύ' },
              right: { personLabel: '2 л. (вы)', greek: 'εσείς', ru: 'вы', slug: 'pronouns/вы εσείς' },
            },
            {
              left: { personLabel: '3 л. м. (он)', greek: 'αυτός', ru: 'он', slug: 'pronouns/он она оно αυτός' },
              right: { personLabel: '3 л. м. (они)', greek: 'αυτοί', ru: 'они (м.)', slug: 'pronouns/они αυτοί' },
            },
            {
              left: { personLabel: '3 л. ж. (она)', greek: 'αυτή', ru: 'она', slug: 'pronouns/он она оно αυτός' },
              right: { personLabel: '3 л. ж. (они)', greek: 'αυτές', ru: 'они (ж.)' },
            },
            {
              left: { personLabel: '3 л. ср. (оно)', greek: 'αυτό', ru: 'оно', slug: 'pronouns/он она оно αυτός' },
              right: { personLabel: '3 л. ср. (они)', greek: 'αυτά', ru: 'они (ср.)' },
            },
          ],
        },
        accusative: {
          case: 'accusative',
          title: 'Винительный падеж (клитики)',
          subtitle: 'Αιτιατική — кого? что? (прямой объект: «меня видит»)',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (я)', greek: 'με', ru: 'меня', slug: 'pronouns/меня με', hint: 'με βλέπει' },
              right: { personLabel: '1 л. (мы)', greek: 'μας', ru: 'нас', slug: 'pronouns/нас вин. μας', hint: 'μας βλέπει' },
            },
            {
              left: { personLabel: '2 л. (ты)', greek: 'σε', ru: 'тебя', slug: 'pronouns/тебя σε', hint: 'σε βλέπει' },
              right: { personLabel: '2 л. (вы)', greek: 'σας', ru: 'вас', slug: 'pronouns/вас вин. σας', hint: 'σας βλέπει' },
            },
            {
              left: { personLabel: '3 л. м. (он)', greek: 'τον', ru: 'его (м.)', slug: 'pronouns/его её вин. τον', hint: 'τον βλέπει' },
              right: { personLabel: '3 л. м. (они)', greek: 'τους', ru: 'их (м.)', slug: 'pronouns/их вин. τους', hint: 'τους βλέπει' },
            },
            {
              left: { personLabel: '3 л. ж. (она)', greek: 'την', ru: 'её (ж.)', slug: 'pronouns/его её вин. τον', hint: 'την βλέπει' },
              right: { personLabel: '3 л. ж. (они)', greek: 'τις / τες', ru: 'их (ж.)', hint: 'τις βλέπει' },
            },
            {
              left: { personLabel: '3 л. ср. (оно)', greek: 'το', ru: 'его (ср.)', slug: 'pronouns/его το', hint: 'το βλέπει' },
              right: { personLabel: '3 л. ср. (они)', greek: 'τα', ru: 'их (ср.)', slug: 'pronouns/их ср. р. τα', hint: 'τα βλέπει' },
            },
          ],
        },
        genitive: {
          case: 'genitive',
          title: 'Родительный падеж (клитики)',
          subtitle: 'Γενική — кому? чей? (косвенный объект и притяжание)',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (я)', greek: 'μου', ru: 'мне / мой', slug: 'pronouns/мой мне μου', hint: 'μου λέει / το σπίτι μου' },
              right: { personLabel: '1 л. (мы)', greek: 'μας', ru: 'нам / наш', slug: 'pronouns/наш нам μας', hint: 'μας λέει / το σπίτι μας' },
            },
            {
              left: { personLabel: '2 л. (ты)', greek: 'σου', ru: 'тебе / твой', slug: 'pronouns/твой тебе σου', hint: 'σου λέει / το σπίτι σου' },
              right: { personLabel: '2 л. (вы)', greek: 'σας', ru: 'вам / ваш', slug: 'pronouns/ваш вам σας', hint: 'σας λέει / το σπίτι σας' },
            },
            {
              left: { personLabel: '3 л. м. (он)', greek: 'του', ru: 'ему / его (м.)', slug: 'pronouns/его ему του', hint: 'του λέει / το σπίτι του' },
              right: { personLabel: '3 л. м. (они)', greek: 'τους', ru: 'им / их (м.)', slug: 'pronouns/их им τους', hint: 'τους λέει / το σπίτι τους' },
            },
            {
              left: { personLabel: '3 л. ж. (она)', greek: 'της', ru: 'ей / её (ж.)', slug: 'pronouns/её ей της', hint: 'της λέει / το σπίτι της' },
              right: { personLabel: '3 л. ж. (они)', greek: 'τους', ru: 'им / их (ж.)', slug: 'pronouns/их им τους', hint: 'τους λέει / το σπίτι τους' },
            },
            {
              left: { personLabel: '3 л. ср. (оно)', greek: 'του', ru: 'ему / его (ср.)', slug: 'pronouns/его ему του', hint: 'του λέει / το σπίти του' },
              right: { personLabel: '3 л. ср. (они)', greek: 'τους', ru: 'им / их (ср.)', slug: 'pronouns/их им τους', hint: 'τους λέει / το σπίτι τους' },
            },
          ],
        },
      },
    },
    {
      id: 'strong',
      label: 'Сильные (ударные)',
      extraNotes: {
        title: 'Употребление сильных форм',
        description: 'Ударные формы используются с предлогами (για μένα, σε σένα), при противопоставлении («видит меня, а не тебя») или для смыслового выделения.',
        examples: [
          { greek: 'Βλέπει εμένα, όχι εσένα.', ru: 'Он видит именно меня, а не тебя (противопоставление).' },
          { greek: 'Αυτό είναι για μένα;', ru: 'Это для меня? (после предлога για).' },
          { greek: 'Εμένα μου αρέσει η Ελλάδα.', ru: 'А мне лично нравится Греция (эмфаза: сильная + слабая форма).' },
        ],
      },
      faces: {
        nominative: {
          case: 'nominative',
          title: 'Именительный падеж',
          subtitle: 'Ονομαστική — кто? что? (подлежащее)',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (я)', greek: 'εγώ', ru: 'я', slug: 'pronouns/я εγώ' },
              right: { personLabel: '1 л. (мы)', greek: 'εμείς', ru: 'мы', slug: 'pronouns/мы εμείς' },
            },
            {
              left: { personLabel: '2 л. (ты)', greek: 'εσύ', ru: 'ты', slug: 'pronouns/ты εσύ' },
              right: { personLabel: '2 л. (вы)', greek: 'εσείς', ru: 'вы', slug: 'pronouns/вы εσείς' },
            },
            {
              left: { personLabel: '3 л. м. (он)', greek: 'αυτός', ru: 'он', slug: 'pronouns/он она оно αυτός' },
              right: { personLabel: '3 л. м. (они)', greek: 'αυτοί', ru: 'они (м.)', slug: 'pronouns/они αυτοί' },
            },
            {
              left: { personLabel: '3 л. ж. (она)', greek: 'αυτή', ru: 'она', slug: 'pronouns/он она оно αυτός' },
              right: { personLabel: '3 л. ж. (они)', greek: 'αυτές', ru: 'они (ж.)' },
            },
            {
              left: { personLabel: '3 л. ср. (оно)', greek: 'αυτό', ru: 'оно', slug: 'pronouns/он она оно αυτός' },
              right: { personLabel: '3 л. ср. (они)', greek: 'αυτά', ru: 'они (ср.)' },
            },
          ],
        },
        accusative: {
          case: 'accusative',
          title: 'Винительный падеж (сильные формы)',
          subtitle: 'Αιτιατική — кого? что? (под ударением или с предлогами)',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (я)', greek: 'εμένα (μένα)', ru: 'меня', hint: 'για μένα' },
              right: { personLabel: '1 л. (мы)', greek: 'εμάς (μας)', ru: 'нас', slug: 'pronouns/к нам εμάς', hint: 'για μας' },
            },
            {
              left: { personLabel: '2 л. (ты)', greek: 'εσένα (σένα)', ru: 'тебя', hint: 'για σένα' },
              right: { personLabel: '2 л. (вы)', greek: 'εσάς (σας)', ru: 'вас', hint: 'για σας' },
            },
            {
              left: { personLabel: '3 л. м. (он)', greek: 'αυτόν', ru: 'его (м.)', hint: 'γι’ αυτόν' },
              right: { personLabel: '3 л. м. (они)', greek: 'αυτούς', ru: 'их (м.)', hint: 'γι’ αυτούς' },
            },
            {
              left: { personLabel: '3 л. ж. (она)', greek: 'αυτή(ν)', ru: 'её (ж.)', hint: 'γι’ αυτήν' },
              right: { personLabel: '3 л. ж. (они)', greek: 'αυτές', ru: 'их (ж.)', hint: 'γι’ αυτές' },
            },
            {
              left: { personLabel: '3 л. ср. (оно)', greek: 'αυτό', ru: 'его (ср.)', hint: 'γι’ αυτό' },
              right: { personLabel: '3 л. ср. (они)', greek: 'αυτά', ru: 'их (ср.)', hint: 'γι’ αυτά' },
            },
          ],
        },
        genitive: {
          case: 'genitive',
          title: 'Родительный падеж (сильные формы)',
          subtitle: 'Γενική — кому? (сильный косвенный объект с предлогом σε)',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (я)', greek: 'εμένα (σε μένα)', ru: 'мне', hint: 'σε μένα' },
              right: { personLabel: '1 л. (мы)', greek: 'εμάς (σε μας)', ru: 'нам', slug: 'pronouns/к нам εμάς', hint: 'σε μας' },
            },
            {
              left: { personLabel: '2 л. (ты)', greek: 'εσένα (σε σένα)', ru: 'тебе', hint: 'σε σένα' },
              right: { personLabel: '2 л. (вы)', greek: 'εσάς (σε σας)', ru: 'вам', hint: 'σε σας' },
            },
            {
              left: { personLabel: '3 л. м. (он)', greek: 'αυτού (σ’ αυτόν)', ru: 'ему / его (м.)', hint: 'σ’ αυτόν' },
              right: { personLabel: '3 л. м. (они)', greek: 'αυτών (σ’ αυτούς)', ru: 'им / их (м.)', hint: 'σ’ αυτούς' },
            },
            {
              left: { personLabel: '3 л. ж. (она)', greek: 'αυτής (σ’ αυτήν)', ru: 'ей / её (ж.)', hint: 'σ’ αυτήν' },
              right: { personLabel: '3 л. ж. (они)', greek: 'αυτών (σ’ αυτές)', ru: 'им / их (ж.)', hint: 'σ’ αυτές' },
            },
            {
              left: { personLabel: '3 л. ср. (оно)', greek: 'αυτού (σ’ αυτό)', ru: 'ему / его (ср.)', hint: 'σ’ αυτό' },
              right: { personLabel: '3 л. ср. (они)', greek: 'αυτών (σ’ αυτά)', ru: 'им / их (ср.)', hint: 'σ’ αυτά' },
            },
          ],
        },
      },
    },
    {
      id: 'possessive',
      label: 'Свой (δικός μου)',
      extraNotes: {
        title: 'Усилительные притяжательные местоимения',
        description: 'Слово δικός согласуется в роде, числе и падеже с существительным, а клитика указывает на владельца.',
        examples: [
          { greek: 'Είναι δικό μου λάθος.', ru: 'Это моя собственная ошибка.' },
          { greek: 'Το δικό σου αυτοκίνητο.', ru: 'Твой собственный автомобиль.' },
          { greek: 'Οι δικοί μας άνθρωποι.', ru: 'Наши близкие / родные.' },
        ],
      },
      faces: {
        nominative: {
          case: 'nominative',
          title: 'Именительный (свой / собственный)',
          subtitle: 'Ονομαστική — мужской род: ο δικός μου...',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (мой)', greek: 'δικός μου', ru: 'мой (собственный)', slug: 'pronouns/мой свой δικός' },
              right: { personLabel: '1 л. (наш)', greek: 'δικός μας', ru: 'наш (собственный)', slug: 'pronouns/наш свой δικός' },
            },
            {
              left: { personLabel: '2 л. (твой)', greek: 'δικός σου', ru: 'твой (собственный)', slug: 'pronouns/твой свой δικός' },
              right: { personLabel: '2 л. (ваш)', greek: 'δικός σας', ru: 'ваш (собственный)', slug: 'pronouns/ваш свой δικός' },
            },
            {
              left: { personLabel: '3 л. м. (его)', greek: 'δικός του', ru: 'его (собственный)' },
              right: { personLabel: '3 л. м. (их)', greek: 'δικός τους', ru: 'их (собственный)' },
            },
            {
              left: { personLabel: '3 л. ж. (её)', greek: 'δικός της', ru: 'её (собственный)' },
              right: { personLabel: '3 л. ж. (их)', greek: 'δικός τους', ru: 'их (собственный)' },
            },
            {
              left: { personLabel: '3 л. ср. (его)', greek: 'δικός του', ru: 'его ср. (собственный)' },
              right: { personLabel: '3 л. ср. (их)', greek: 'δικός τους', ru: 'их (собственный)' },
            },
          ],
        },
        accusative: {
          case: 'accusative',
          title: 'Винительный (своего / собственное)',
          subtitle: 'Αιτιατική — мужской род: τον δικό μου...',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (моего)', greek: 'δικό μου', ru: 'моего / мой' },
              right: { personLabel: '1 л. (наших)', greek: 'δικούς μας', ru: 'наших' },
            },
            {
              left: { personLabel: '2 л. (твоего)', greek: 'δικό σου', ru: 'твоего / твой' },
              right: { personLabel: '2 л. (ваших)', greek: 'δικούς σας', ru: 'ваших' },
            },
            {
              left: { personLabel: '3 л. м. (его)', greek: 'δικό του', ru: 'его' },
              right: { personLabel: '3 л. м. (их)', greek: 'δικούς τους', ru: 'их' },
            },
            {
              left: { personLabel: '3 л. ж. (её)', greek: 'δικό της', ru: 'её' },
              right: { personLabel: '3 л. ж. (их)', greek: 'δικούς τους', ru: 'их' },
            },
            {
              left: { personLabel: '3 л. ср. (его)', greek: 'δικό του', ru: 'его' },
              right: { personLabel: '3 л. ср. (их)', greek: 'δικούς τους', ru: 'их' },
            },
          ],
        },
        genitive: {
          case: 'genitive',
          title: 'Родительный (своего)',
          subtitle: 'Γενική — мужской род: του δικού μου...',
          colLeftTitle: 'Единственное',
          colRightTitle: 'Множественное',
          rows: [
            {
              left: { personLabel: '1 л. (моего)', greek: 'δικού μου', ru: 'моего' },
              right: { personLabel: '1 л. (наших)', greek: 'δικών μας', ru: 'наших' },
            },
            {
              left: { personLabel: '2 л. (твоего)', greek: 'δικού σου', ru: 'твоего' },
              right: { personLabel: '2 л. (ваших)', greek: 'δικών σας', ru: 'ваших' },
            },
            {
              left: { personLabel: '3 л. м. (его)', greek: 'δικού του', ru: 'его' },
              right: { personLabel: '3 л. м. (их)', greek: 'δικών τους', ru: 'их' },
            },
            {
              left: { personLabel: '3 л. ж. (её)', greek: 'δικού της', ru: 'её' },
              right: { personLabel: '3 л. ж. (их)', greek: 'δικών τους', ru: 'их' },
            },
            {
              left: { personLabel: '3 л. ср. (его)', greek: 'δικού του', ru: 'его' },
              right: { personLabel: '3 л. ср. (их)', greek: 'δικών τους', ru: 'их' },
            },
          ],
        },
      },
    },
  ],
};

function makeDemonstrativeParadigm(id: string, tabLabel: string, baseM: string, baseF: string, baseN: string, translation: string, wordSlugM?: string, wordSlugPl?: string): PronounParadigm {
  const stem = baseM.slice(0, -2);
  const isEkeinos = id === 'demonstrative_ekeinos';
  const isTetoios = id === 'demonstrative_tetoios';

  return {
    id,
    title: `Указательное: ${baseM} (${translation})`,
    tabLabel,
    defaultCase: 'nominative',
    defaultVariant: 'singular',
    variants: [
      {
        id: 'singular',
        label: 'Единственное число',
        extraNotes: {
          title: `Склонение ${baseM} в единственном числе`,
          description: `Согласуется с существительным в роде, числе и падеже. Ставится с определённым артиклем: ${baseM} ο άντρας, ${baseF} η γυναίκα, ${baseN} το παιδί.`,
          examples: [
            { greek: `${baseM} ο άνθρωπος`, ru: `${translation} человек` },
            { greek: `Σε ${isEkeinos ? 'εκείνο' : isTetoios ? 'τέτοιο' : 'αυτό'} το σπίτι`, ru: `В ${isEkeinos ? 'том' : isTetoios ? 'таком' : 'этом'} доме` },
          ],
        },
        faces: {
          nominative: {
            case: 'nominative',
            title: 'Именительный падеж (ед. ч.)',
            subtitle: 'Ονομαστική — кто? что?',
            colLeftTitle: 'Род',
            colRightTitle: 'Форма',
            rows: [
              {
                left: { personLabel: 'Мужской (αρσενικό)', greek: baseM, ru: translation, slug: wordSlugM },
                right: { personLabel: 'Пример с артиклем', greek: `${baseM} ο...`, ru: `${translation} (муж.)` },
              },
              {
                left: { personLabel: 'Женский (θηλυκό)', greek: baseF, ru: translation.replace(/от$/, 'та').replace(/тот$/, 'та').replace(/такой$/, 'такая') },
                right: { personLabel: 'Пример с артиклем', greek: `${baseF} η...`, ru: 'женский род' },
              },
              {
                left: { personLabel: 'Средний (ουδέτερο)', greek: baseN, ru: translation.replace(/от$/, 'то').replace(/тот$/, 'то').replace(/такой$/, 'такое') },
                right: { personLabel: 'Пример с артиклем', greek: `${baseN} το...`, ru: 'средний род' },
              },
            ],
          },
          accusative: {
            case: 'accusative',
            title: 'Винительный падеж (ед. ч.)',
            subtitle: 'Αιτιατική — кого? что?',
            colLeftTitle: 'Род',
            colRightTitle: 'Форма',
            rows: [
              {
                left: { personLabel: 'Мужской (αρσενικό)', greek: `${stem}ον`, ru: 'кого? что?' },
                right: { personLabel: 'Пример с артиклем', greek: `τον ${stem}ον...`, ru: 'вин. муж.' },
              },
              {
                left: { personLabel: 'Женский (θηλυκό)', greek: `${stem}η(ν)`, ru: 'кого? что?' },
                right: { personLabel: 'Пример с артиклем', greek: `την ${stem}η(ν)...`, ru: 'вин. жен.' },
              },
              {
                left: { personLabel: 'Средний (ουδέτερο)', greek: baseN, ru: 'кого? что?' },
                right: { personLabel: 'Пример с артиклем', greek: `το ${baseN}...`, ru: 'вин. сред.' },
              },
            ],
          },
          genitive: {
            case: 'genitive',
            title: 'Родительный падеж (ед. ч.)',
            subtitle: 'Γενική — кого? чего? чей?',
            colLeftTitle: 'Род',
            colRightTitle: 'Форма',
            rows: [
              {
                left: { personLabel: 'Мужской (αρσενικό)', greek: `${stem}ου`, ru: 'чей? (муж.)' },
                right: { personLabel: 'Пример с артиклем', greek: `του ${stem}ου...`, ru: 'род. муж.' },
              },
              {
                left: { personLabel: 'Женский (θηλυκό)', greek: `${stem}ης`, ru: 'чей? (жен.)' },
                right: { personLabel: 'Пример с артиклем', greek: `της ${stem}ης...`, ru: 'род. жен.' },
              },
              {
                left: { personLabel: 'Средний (ουδέτερο)', greek: `${stem}ου`, ru: 'чей? (сред.)' },
                right: { personLabel: 'Пример с артиклем', greek: `του ${stem}ου...`, ru: 'род. сред.' },
              },
            ],
          },
        },
      },
      {
        id: 'plural',
        label: 'Множественное число',
        extraNotes: {
          title: `Склонение ${baseM} во множественном числе`,
          description: 'Во множественном числе родительный падеж одинаков для всех трёх родов.',
          examples: [
            { greek: `${stem}οι οι άνθρωποι`, ru: `эти/те люди` },
            { greek: `Από ${stem}α τα μέρη`, ru: `Из этих/тех мест` },
          ],
        },
        faces: {
          nominative: {
            case: 'nominative',
            title: 'Именительный падеж (мн. ч.)',
            subtitle: 'Ονομαστική — кто? что? (множественное число)',
            colLeftTitle: 'Род',
            colRightTitle: 'Форма',
            rows: [
              {
                left: { personLabel: 'Мужской (αρσενικό)', greek: `${stem}οι`, ru: 'эти / те (м.)', slug: wordSlugPl },
                right: { personLabel: 'Пример с артиклем', greek: `οι ${stem}οι...`, ru: 'мн. муж.' },
              },
              {
                left: { personLabel: 'Женский (θηλυκό)', greek: `${stem}ες`, ru: 'эти / те (ж.)' },
                right: { personLabel: 'Пример с артиклем', greek: `οι ${stem}ες...`, ru: 'мн. жен.' },
              },
              {
                left: { personLabel: 'Средний (ουδέτερο)', greek: `${stem}α`, ru: 'эти / те (ср.)' },
                right: { personLabel: 'Пример с артиклем', greek: `τα ${stem}α...`, ru: 'мн. сред.' },
              },
            ],
          },
          accusative: {
            case: 'accusative',
            title: 'Винительный падеж (мн. ч.)',
            subtitle: 'Αιτιατική — кого? что? (множественное число)',
            colLeftTitle: 'Род',
            colRightTitle: 'Форма',
            rows: [
              {
                left: { personLabel: 'Мужской (αρσενικό)', greek: `${stem}ους`, ru: 'кого? (мн. м.)' },
                right: { personLabel: 'Пример с артиклем', greek: `τους ${stem}ους...`, ru: 'вин. мн. муж.' },
              },
              {
                left: { personLabel: 'Женский (θηλυκό)', greek: `${stem}ες`, ru: 'кого? (мн. ж.)' },
                right: { personLabel: 'Пример с артиклем', greek: `τις ${stem}ες...`, ru: 'вин. мн. жен.' },
              },
              {
                left: { personLabel: 'Средний (ουδέτερο)', greek: `${stem}α`, ru: 'кого? (мн. ср.)' },
                right: { personLabel: 'Пример с артиклем', greek: `τα ${stem}α...`, ru: 'вин. мн. сред.' },
              },
            ],
          },
          genitive: {
            case: 'genitive',
            title: 'Родительный падеж (мн. ч.)',
            subtitle: 'Γενική — кого? чего? чей? (общая форма для всех родов)',
            colLeftTitle: 'Род',
            colRightTitle: 'Форма',
            rows: [
              {
                left: { personLabel: 'Все рода (όλα τα γένη)', greek: `${stem}ων`, ru: 'кого? чего? чей?' },
                right: { personLabel: 'Пример с артиклем', greek: `των ${stem}ων...`, ru: 'род. мн. всех родов' },
              },
            ],
          },
        },
      },
    ],
  };
}

export const DEMONSTRATIVE_AUTOS = makeDemonstrativeParadigm('demonstrative_autos', 'Этот (αυτός)', 'αυτός', 'αυτή', 'αυτό', 'этот', 'pronouns/этот эта это αυτός', 'pronouns/эти αυτοί');
export const DEMONSTRATIVE_EKEINOS = makeDemonstrativeParadigm('demonstrative_ekeinos', 'Тот (εκείνος)', 'εκείνος', 'εκείνη', 'εκείνο', 'тот', 'pronouns/тот та то εκείνος', 'pronouns/те εκείνοι');
export const DEMONSTRATIVE_TETOIOS = makeDemonstrativeParadigm('demonstrative_tetoios', 'Такой (τέτοιος)', 'τέτοιος', 'τέτοια', 'τέτοιο', 'такой', 'pronouns/такой такая τέτοιος', 'pronouns/такие τέτοιοι');

export const INTERROGATIVE_POIOS: PronounParadigm = {
  id: 'interrogative_poios',
  title: 'Вопросительное: ποιος (кто? какой?)',
  tabLabel: 'Кто/Какой (ποιος)',
  defaultCase: 'nominative',
  defaultVariant: 'singular',
  variants: [
    {
      id: 'singular',
      label: 'Единственное число',
      extraNotes: {
        title: 'Употребление ποιος / ποια / ποιο',
        description: 'Склоняется по родам и падежам. В родительном падеже параллельно используется неизменяемое τίνος («чей?»).',
        examples: [
          { greek: 'Ποιος είναι αυτός;', ru: 'Кто это?' },
          { greek: 'Ποιο βιβλίο διαβάζεις;', ru: 'Какую книгу ты читаешь?' },
          { greek: 'Τίνος είναι αυτό;', ru: 'Чьё это?' },
        ],
      },
      faces: {
        nominative: {
          case: 'nominative',
          title: 'Именительный падеж (ед. ч.)',
          subtitle: 'Ονομαστική — кто? какой?',
          colLeftTitle: 'Род',
          colRightTitle: 'Форма',
          rows: [
            {
              left: { personLabel: 'Мужской (αρσενικό)', greek: 'ποιος', ru: 'кто? какой?', slug: 'pronouns/кто какой ποιος' },
              right: { personLabel: 'Женский (θηλυκό)', greek: 'ποια', ru: 'кто? какая?' },
            },
            {
              left: { personLabel: 'Средний (ουδέτερο)', greek: 'ποιο', ru: 'что? какое?' },
              right: { personLabel: 'Неизменяемое (кто/что)', greek: 'τι', ru: 'что? какой? (разг.)', slug: 'pronouns/что τι' },
            },
          ],
        },
        accusative: {
          case: 'accusative',
          title: 'Винительный падеж (ед. ч.)',
          subtitle: 'Αιτιατική — кого? какого?',
          colLeftTitle: 'Род',
          colRightTitle: 'Форма',
          rows: [
            {
              left: { personLabel: 'Мужской (αρσενικό)', greek: 'ποιον', ru: 'кого? какого?' },
              right: { personLabel: 'Женский (θηλυκό)', greek: 'ποια(ν)', ru: 'кого? какую?' },
            },
            {
              left: { personLabel: 'Средний (ουδέτερο)', greek: 'ποιο', ru: 'что? какое?' },
              right: { personLabel: 'С предлогом σε', greek: 'σε ποιον;', ru: 'кому?' },
            },
          ],
        },
        genitive: {
          case: 'genitive',
          title: 'Родительный падеж (ед. ч.)',
          subtitle: 'Γενική — чей? кого? чего?',
          colLeftTitle: 'Род',
          colRightTitle: 'Форма',
          rows: [
            {
              left: { personLabel: 'Мужской / Средний', greek: 'ποιου (τίνος)', ru: 'чьего? чьё?', slug: 'pronouns/чей τίνος' },
              right: { personLabel: 'Женский род', greek: 'ποιας (τίνος)', ru: 'чьей?' },
            },
          ],
        },
      },
    },
    {
      id: 'plural',
      label: 'Множественное число',
      extraNotes: {
        title: 'Множественное число ποιος',
        description: 'Во множественном числе формы ποιοι (м.), ποιες (ж.), ποια (ср.).',
        examples: [
          { greek: 'Ποιοι είναι αυτοί;', ru: 'Кто они (эти люди)?' },
          { greek: 'Ποιες μέρες δουλεύεις;', ru: 'В какие дни ты работаешь?' },
        ],
      },
      faces: {
        nominative: {
          case: 'nominative',
          title: 'Именительный падеж (мн. ч.)',
          subtitle: 'Ονομαστική — какие? кто?',
          colLeftTitle: 'Род',
          colRightTitle: 'Форма',
          rows: [
            {
              left: { personLabel: 'Мужской (αρσενικό)', greek: 'ποιοι', ru: 'кто? какие? (м.)' },
              right: { personLabel: 'Женский (θηλυκό)', greek: 'ποιες', ru: 'кто? какие? (ж.)' },
            },
            {
              left: { personLabel: 'Средний (ουδέτερο)', greek: 'ποια', ru: 'какие? (ср.)' },
              right: { personLabel: 'Неизменяемое', greek: 'τίνος', ru: 'чьи?', slug: 'pronouns/чей τίνος' },
            },
          ],
        },
        accusative: {
          case: 'accusative',
          title: 'Винительный падеж (мн. ч.)',
          subtitle: 'Αιτιατική — каких? кого?',
          colLeftTitle: 'Род',
          colRightTitle: 'Форма',
          rows: [
            {
              left: { personLabel: 'Мужской (αρσενικό)', greek: 'ποιους', ru: 'кого? каких? (м.)' },
              right: { personLabel: 'Женский (θηλυκό)', greek: 'ποιες', ru: 'кого? каких? (ж.)' },
            },
            {
              left: { personLabel: 'Средний (ουδέτερο)', greek: 'ποια', ru: 'каких? (ср.)' },
              right: { personLabel: 'С предлогом σε', greek: 'σε ποιους;', ru: 'кому?' },
            },
          ],
        },
        genitive: {
          case: 'genitive',
          title: 'Родительный падеж (мн. ч.)',
          subtitle: 'Γενική — чьих? кого?',
          colLeftTitle: 'Род',
          colRightTitle: 'Форма',
          rows: [
            {
              left: { personLabel: 'Все рода (общая форма)', greek: 'ποιων (τίνος)', ru: 'чьих? кого?' },
              right: { personLabel: 'Разговорное', greek: 'τίνος', ru: 'чей / чьи', slug: 'pronouns/чей τίνος' },
            },
          ],
        },
      },
    },
  ],
};

export const ALL_PRONOUN_PARADIGMS: PronounParadigm[] = [
  PERSONAL_PARADIGM,
  DEMONSTRATIVE_AUTOS,
  DEMONSTRATIVE_EKEINOS,
  DEMONSTRATIVE_TETOIOS,
  INTERROGATIVE_POIOS,
];

export function getParadigmForWordSlug(slug: string): {
  paradigm: PronounParadigm;
  initialCase: PronounCase;
  initialVariant: string;
  highlightForm: string;
} | null {
  const norm = slug.replace(/^words\//, '').replace(/\.md$/, '').replace(/\.html$/, '');

  // 1. Personal pronouns
  const personalAccusatives: Record<string, string> = {
    'pronouns/меня με': 'με',
    'pronouns/тебя σε': 'σε',
    'pronouns/его её вин. τον': 'τον',
    'pronouns/его το': 'το',
    'pronouns/нас вин. μας': 'μας',
    'pronouns/вас вин. σας': 'σας',
    'pronouns/их вин. τους': 'τους',
    'pronouns/их ср. р. τα': 'τα',
    'pronouns/меня тебя με σε': 'με',
  };

  const personalGenitives: Record<string, string> = {
    'pronouns/мой мне μου': 'μου',
    'pronouns/твой тебе σου': 'σου',
    'pronouns/его ему του': 'του',
    'pronouns/её ей της': 'της',
    'pronouns/наш нам μας': 'μας',
    'pronouns/ваш вам σας': 'σας',
    'pronouns/их им τους': 'τους',
    'pronouns/к нам εμάς': 'εμάς',
    'pronouns/косвенный объект μου': 'μου',
  };

  const personalNominatives: Record<string, string> = {
    'pronouns/я εγώ': 'εγώ',
    'pronouns/ты εσύ': 'εσύ',
    'pronouns/он она оно αυτός': 'αυτός',
    'pronouns/мы εμείς': 'εμείς',
    'pronouns/вы εσείς': 'εσείς',
    'pronouns/они αυτοί': 'αυτοί',
  };

  const possessiveDikos: Record<string, string> = {
    'pronouns/мой свой δικός': 'δικός μου',
    'pronouns/твой свой δικός': 'δικός σου',
    'pronouns/наш свой δικός': 'δικός μας',
    'pronouns/ваш свой δικός': 'δικός σας',
  };

  if (personalAccusatives[norm]) {
    return {
      paradigm: PERSONAL_PARADIGM,
      initialCase: 'accusative',
      initialVariant: 'weak',
      highlightForm: personalAccusatives[norm],
    };
  }

  if (personalGenitives[norm]) {
    return {
      paradigm: PERSONAL_PARADIGM,
      initialCase: 'genitive',
      initialVariant: 'weak',
      highlightForm: personalGenitives[norm],
    };
  }

  if (personalNominatives[norm]) {
    return {
      paradigm: PERSONAL_PARADIGM,
      initialCase: 'nominative',
      initialVariant: 'weak',
      highlightForm: personalNominatives[norm],
    };
  }

  if (possessiveDikos[norm]) {
    return {
      paradigm: PERSONAL_PARADIGM,
      initialCase: 'nominative',
      initialVariant: 'possessive',
      highlightForm: possessiveDikos[norm],
    };
  }

  // 2. Demonstratives
  if (norm === 'pronouns/этот эта это αυτός') {
    return { paradigm: DEMONSTRATIVE_AUTOS, initialCase: 'nominative', initialVariant: 'singular', highlightForm: 'αυτός' };
  }
  if (norm === 'pronouns/эти αυτοί') {
    return { paradigm: DEMONSTRATIVE_AUTOS, initialCase: 'nominative', initialVariant: 'plural', highlightForm: 'αυτοί' };
  }

  if (norm === 'pronouns/тот та то εκείνος') {
    return { paradigm: DEMONSTRATIVE_EKEINOS, initialCase: 'nominative', initialVariant: 'singular', highlightForm: 'εκείνος' };
  }
  if (norm === 'pronouns/те εκείνοι') {
    return { paradigm: DEMONSTRATIVE_EKEINOS, initialCase: 'nominative', initialVariant: 'plural', highlightForm: 'εκείνοι' };
  }

  if (norm === 'pronouns/такой такая τέτοιος') {
    return { paradigm: DEMONSTRATIVE_TETOIOS, initialCase: 'nominative', initialVariant: 'singular', highlightForm: 'τέτοιος' };
  }
  if (norm.includes('τέτοιοι')) {
    return { paradigm: DEMONSTRATIVE_TETOIOS, initialCase: 'nominative', initialVariant: 'plural', highlightForm: 'τέτοιοι' };
  }

  // 3. Interrogatives
  if (norm === 'pronouns/кто какой ποιος') {
    return { paradigm: INTERROGATIVE_POIOS, initialCase: 'nominative', initialVariant: 'singular', highlightForm: 'ποιος' };
  }
  if (norm === 'pronouns/чей τίνος') {
    return { paradigm: INTERROGATIVE_POIOS, initialCase: 'genitive', initialVariant: 'singular', highlightForm: 'τίνος' };
  }
  if (norm === 'pronouns/что τι') {
    return { paradigm: INTERROGATIVE_POIOS, initialCase: 'nominative', initialVariant: 'singular', highlightForm: 'τι' };
  }

  return null;
}

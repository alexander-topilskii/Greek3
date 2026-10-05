import fs from 'fs';
import path from 'path';

export interface BookParagraph {
  index: number;
  greek: string;
  russian: string;
}

export interface BookScene {
  title: string;
  paragraphs: BookParagraph[];
}

export interface BookChapter {
  bookId: string;
  chapterId: string;
  bookTitle: string;
  chapterTitle: string;
  level: string;
  scenes: BookScene[];
  totalParagraphs: number;
  filePath: string;
}

export function parseBookChapter(filePath: string, bookId: string, chapterId: string): BookChapter {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  let bookTitle = 'Книга';
  let chapterTitle = 'Глава';
  let level = 'A1–A2';
  const scenes: BookScene[] = [];
  let currentScene: BookScene | null = null;
  let paraIndex = 1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (line.startsWith('# ')) {
      bookTitle = line.slice(2).trim();
      continue;
    }
    if (line.startsWith('## ')) {
      chapterTitle = line.slice(3).trim();
      continue;
    }
    if (line.includes('**Уровень:**')) {
      const match = line.match(/\*\*Уровень:\*\*\s*([^(]+)/);
      if (match) level = match[1].trim();
      continue;
    }
    if (line.startsWith('### ')) {
      currentScene = { title: line.slice(4).trim(), paragraphs: [] };
      scenes.push(currentScene);
      continue;
    }

    if (line.startsWith('- **EL:**')) {
      const greek = line.replace(/^- \*\*EL:\*\*\s*/, '').trim();
      let russian = '';
      if (i + 1 < lines.length && lines[i + 1].trim().startsWith('**RU:**')) {
        russian = lines[i + 1].trim().replace(/^\*\*RU:\*\*\s*/, '').trim();
        i++;
      }
      if (!currentScene) {
        currentScene = { title: 'Текст', paragraphs: [] };
        scenes.push(currentScene);
      }
      currentScene.paragraphs.push({
        index: paraIndex++,
        greek,
        russian,
      });
    }
  }

  return {
    bookId,
    chapterId,
    bookTitle,
    chapterTitle,
    level,
    scenes,
    totalParagraphs: paraIndex - 1,
    filePath,
  };
}

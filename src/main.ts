import { createLocalLeaderboard } from './services/leaderboard';
import { initTelegram, tgExpand, tgReady } from './services/telegram';
import { showCountdown, showResult, showStart } from './ui/screens';
import { startGame } from './ui/play';

const NAME_KEY = 'dzoragyugh.playerName';

const readName = (): string => {
  try { return localStorage.getItem(NAME_KEY) ?? ''; } catch { return ''; }
};

const saveName = (name: string): void => {
  try { localStorage.setItem(NAME_KEY, name); } catch { /* приватный режим — не критично */ }
};

async function boot(): Promise<void> {
  const tg = await initTelegram();
  tgReady();
  tgExpand();
  const lb = createLocalLeaderboard();
  const initialName = tg.userName ?? readName();

  const launch = (name: string): void => {
    showCountdown(() => {
      startGame({
        name,
        lb,
        onFinished: (run) => {
          showResult({
            name: run.name,
            stats: run.stats,
            verdict: run.verdict,
            submit: run.submit,
            onAgain: () => launch(name),
            onMenu: () => showStart({ tgAvailable: tg.available, initialName: name, lb, onStart: (n) => { saveName(n); launch(n); } }),
          });
        },
      });
    });
  };

  showStart({ tgAvailable: tg.available, initialName, lb, onStart: (name) => { saveName(name); launch(name); } });
}

void boot();

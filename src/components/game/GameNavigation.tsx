import { useNavigate } from 'react-router-dom';
import { useGame } from './useGameContext';

export function useGameNavigate() {
  const navigate = useNavigate();
  const { startDriving } = useGame();

  const gameNavigate = (to: string) => {
    const majorPages = [
      '/',
      '/trollstown',
      '/dealership',
      '/mechanic',
      '/hospital',
      '/general-store',
      '/store',
      '/marketplace',
      '/auctions',
      '/inventory',
      '/wall',
      '/leaderboard',
      '/messages',
      '/support',
      '/safety',
      '/family',
      '/family/lounge',
      '/officer',
      '/officer/dashboard',
      '/officer/moderation',
      '/lead-officer',
      '/secretary',
      '/application',
      '/wallet'
    ];

    const needsDriving = majorPages.some(page => to.startsWith(page));

    if (needsDriving) {
      let destName = 'Destination';
      if (to === '/' || to.startsWith('/home')) destName = 'Home';
      else if (to.includes('trollstown') || to.includes('trolls-town')) destName = 'Troll Town';
      else if (to.includes('dealership')) destName = 'Car Dealership';
      else if (to.includes('mechanic')) destName = 'Mechanic Shop';
      else if (to.includes('hospital')) destName = 'Hospital';
      else if (to.includes('general-store')) destName = 'General Store';
      else if (to.includes('/store')) destName = 'Coin Store';
      else if (to.includes('/marketplace')) destName = 'Marketplace';
      else if (to.includes('/inventory')) destName = 'Inventory';
      else if (to.includes('/wall')) destName = 'The Wall';
      else if (to.includes('/leaderboard')) destName = 'Leaderboard';
      else if (to.includes('/messages')) destName = 'Messages';
      else if (to.includes('/support')) destName = 'Support Center';
      else if (to.includes('/safety')) destName = 'Safety Office';
      else if (to.includes('/family')) destName = 'Family Lounge';
      else if (to.includes('/officer/dashboard')) destName = 'Officer HQ';
      else if (to.includes('/officer/moderation')) destName = 'Officer Moderation';
      else if (to.includes('/lead-officer')) destName = 'Lead HQ';
      else if (to.includes('/secretary')) destName = 'Secretary Console';
      else if (to.includes('/application')) destName = 'Applications';
      else if (to.includes('/wallet')) destName = 'Wallet';

      startDriving(destName, () => {
        navigate(to);
      });
    } else {
      navigate(to);
    }
  };

  return gameNavigate;
}

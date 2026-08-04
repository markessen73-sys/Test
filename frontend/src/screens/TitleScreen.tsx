import { unlockGameAudio } from '../gameAudio';
import { assetUrl } from '../assetUrl';

interface TitleScreenProps {
  onEnterGym: () => void;
  onHowToPlay: () => void;
  onOptions: () => void;
}

/**
 * Opening title — brand-first, full-bleed Mick caricature, three clear actions.
 */
export function TitleScreen({ onEnterGym, onHowToPlay, onOptions }: TitleScreenProps) {
  const start = (action: () => void) => {
    unlockGameAudio();
    action();
  };

  return (
    <div className="title-screen" role="main" aria-label="Mick's Boxing Gym">
      <div className="title-hero" aria-hidden="true">
        <img
          className="title-hero-img"
          src={assetUrl('/brand/mick-trainer-hero.webp')}
          alt=""
          draggable={false}
        />
        <div className="title-hero-shade" />
        <div className="title-hero-grain" />
      </div>

      <div className="title-content">
        <p className="title-kicker">Est. forever · Open late</p>
        <h1 className="title-brand">
          <span className="title-brand-line">Mick&apos;s</span>
          <span className="title-brand-line title-brand-sub">Boxing Gym</span>
        </h1>
        <p className="title-tagline">Gloves up. Face the bag. Earn the round.</p>

        <nav className="title-actions" aria-label="Main menu">
          <button type="button" className="title-btn title-btn-primary" onClick={() => start(onEnterGym)}>
            Enter Gym
          </button>
          <button type="button" className="title-btn title-btn-ghost" onClick={() => start(onHowToPlay)}>
            How to Play
          </button>
          <button type="button" className="title-btn title-btn-ghost" onClick={() => start(onOptions)}>
            Options
          </button>
        </nav>
      </div>
    </div>
  );
}

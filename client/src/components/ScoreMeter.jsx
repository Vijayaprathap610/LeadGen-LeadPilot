import { PRIORITY_LABEL } from '../utils/format';

/** 0-100 track with ticks at the real medium and high cut-offs, so the bar shows where a score sits against them. */
export default function ScoreMeter({ score, priority, thresholds, provisional = false }) {
  const label = `Score ${score} out of 100, ${PRIORITY_LABEL[priority].toLowerCase()} priority${provisional ? ', provisional' : ''}`;
  return (
    <div className="meter" role="img" aria-label={label}>
      <div className="meter-track" aria-hidden="true">
        <div className={`meter-fill meter-${priority}${provisional ? ' meter-provisional' : ''}`} style={{ width: `${score}%` }} />
        <span className="meter-tick" style={{ left: `${thresholds.mediumThreshold}%` }} />
        <span className="meter-tick" style={{ left: `${thresholds.highThreshold}%` }} />
      </div>
      <span className="meter-value" aria-hidden="true">{score}</span>
    </div>
  );
}

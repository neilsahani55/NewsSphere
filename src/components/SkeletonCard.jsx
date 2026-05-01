export default function SkeletonCard() {
  return (
    <div className="skel-card" aria-hidden>
      <div className="skel" style={{ height: 11, width: '38%' }} />
      <div className="skel" style={{ height: 18, width: '88%' }} />
      <div className="skel" style={{ height: 13, width: '94%' }} />
      <div className="skel" style={{ height: 13, width: '70%' }} />
      <div className="skel" style={{ height: 11, width: '32%' }} />
    </div>
  );
}

import { memo } from 'react';

const QUOTES = [
  { q: 'Be the change you wish to see in the world.', a: 'Mahatma Gandhi' },
  { q: 'You must be the change you want to see in the world.', a: 'Mahatma Gandhi' },
  { q: 'First they ignore you, then they laugh at you, then they fight you, then you win.', a: 'Mahatma Gandhi' },
  { q: 'Live as if you were to die tomorrow. Learn as if you were to live forever.', a: 'Mahatma Gandhi' },
  { q: 'Dream, dream, dream. Dreams transform into thoughts and thoughts result in action.', a: 'A. P. J. Abdul Kalam' },
  { q: 'You have to dream before your dreams can come true.', a: 'A. P. J. Abdul Kalam' },
  { q: 'Excellence is a continuous process and not an accident.', a: 'A. P. J. Abdul Kalam' },
  { q: 'If you fail, never give up because FAIL means First Attempt In Learning.', a: 'A. P. J. Abdul Kalam' },
  { q: 'Man needs his difficulties because they are necessary to enjoy success.', a: 'A. P. J. Abdul Kalam' },
  { q: 'The function of education is to teach one to think intensively and to think critically.', a: 'Martin Luther King Jr.' },
  { q: 'Education is the most powerful weapon which you can use to change the world.', a: 'Nelson Mandela' },
  { q: 'It always seems impossible until it\'s done.', a: 'Nelson Mandela' },
  { q: 'I have a dream that my four little children will one day live in a nation where they will not be judged by the color of their skin but by the content of their character.', a: 'Martin Luther King Jr.' },
  { q: 'Injustice anywhere is a threat to justice everywhere.', a: 'Martin Luther King Jr.' },
  { q: 'The roots of education are bitter, but the fruit is sweet.', a: 'Aristotle' },
  { q: 'Imagination is more important than knowledge. For knowledge is limited, whereas imagination encircles the world.', a: 'Albert Einstein' },
  { q: 'In the middle of every difficulty lies opportunity.', a: 'Albert Einstein' },
  { q: 'Life is what happens to you while you\'re busy making other plans.', a: 'John Lennon' },
  { q: 'The only way to do great work is to love what you do.', a: 'Steve Jobs' },
  { q: 'Stay hungry, stay foolish.', a: 'Steve Jobs' },
  { q: 'The greatest glory in living lies not in never falling, but in rising every time we fall.', a: 'Nelson Mandela' },
  { q: 'Where there is love there is life.', a: 'Mahatma Gandhi' },
  { q: 'The strength of a nation derives from the integrity of the home.', a: 'Confucius' },
  { q: 'I think, therefore I am.', a: 'René Descartes' },
  { q: 'To be or not to be, that is the question.', a: 'William Shakespeare' },
  { q: 'Ask not what your country can do for you — ask what you can do for your country.', a: 'John F. Kennedy' },
  { q: 'An investment in knowledge pays the best interest.', a: 'Benjamin Franklin' },
  { q: 'It does not matter how slowly you go as long as you do not stop.', a: 'Confucius' },
  { q: 'Our greatest glory is not in never failing, but in rising up every time we fail.', a: 'Confucius' },
  { q: 'The journey of a thousand miles begins with one step.', a: 'Lao Tzu' },
  { q: 'The purpose of our lives is to be happy.', a: 'Dalai Lama' },
  { q: 'With the new day comes new strength and new thoughts.', a: 'Eleanor Roosevelt' },
  { q: 'In the end, it\'s not the years in your life that count. It\'s the life in your years.', a: 'Abraham Lincoln' },
  { q: 'The best time to plant a tree was 20 years ago. The second best time is now.', a: 'Chinese Proverb' },
  { q: 'Life is not measured by the number of breaths we take, but by the moments that take our breath away.', a: 'Maya Angelou' },
  { q: 'Whatever you are, be a good one.', a: 'Abraham Lincoln' },
  { q: 'The future belongs to those who believe in the beauty of their dreams.', a: 'Eleanor Roosevelt' },
  { q: 'Do not watch the clock; do what it does. Keep going.', a: 'Sam Levenson' },
  { q: 'Keep your face always toward the sunshine, and shadows will fall behind you.', a: 'Walt Whitman' },
  { q: 'You are never too old to set another goal or to dream a new dream.', a: 'C. S. Lewis' },
  { q: 'Spread love everywhere you go. Let no one ever come to you without leaving happier.', a: 'Mother Teresa' },
  { q: 'If you look at what you have in life, you\'ll always have more.', a: 'Oprah Winfrey' },
  { q: 'You will face many defeats in life, but never let yourself be defeated.', a: 'Maya Angelou' },
  { q: 'The only impossible journey is the one you never begin.', a: 'Tony Robbins' },
  { q: 'Life is short, and it is here to be lived.', a: 'Kate Winslet' },
  { q: 'It is during our darkest moments that we must focus to see the light.', a: 'Aristotle' },
  { q: 'Whoever is happy will make others happy too.', a: 'Anne Frank' },
  { q: 'Do not go where the path may lead, go instead where there is no path and leave a trail.', a: 'Ralph Waldo Emerson' },
  { q: 'Try to be a rainbow in someone\'s cloud.', a: 'Maya Angelou' },
  { q: 'You only live once, but if you do it right, once is enough.', a: 'Mae West' },
  { q: 'A person who never made a mistake never tried anything new.', a: 'Albert Einstein' },
  { q: 'The secret of getting ahead is getting started.', a: 'Mark Twain' },
  { q: 'It\'s not whether you get knocked down, it\'s whether you get up.', a: 'Vince Lombardi' },
  { q: 'Happiness is not something ready-made. It comes from your own actions.', a: 'Dalai Lama' },
  { q: 'Arise, awake, and stop not till the goal is reached.', a: 'Swami Vivekananda' },
  { q: 'Take risks in your life. If you win, you can lead; if you lose, you can guide.', a: 'Swami Vivekananda' },
  { q: 'You cannot believe in God until you believe in yourself.', a: 'Swami Vivekananda' },
  { q: 'In a gentle way, you can shake the world.', a: 'Mahatma Gandhi' },
  { q: 'I am not a product of my circumstances. I am a product of my decisions.', a: 'Stephen Covey' },
  { q: 'Life is really simple, but we insist on making it complicated.', a: 'Confucius' },
  { q: 'May you live every day of your life.', a: 'Jonathan Swift' },
  { q: 'Every moment is a fresh beginning.', a: 'T. S. Eliot' },
  { q: 'The best revenge is massive success.', a: 'Frank Sinatra' },
  { q: 'What lies behind us and what lies before us are tiny matters compared to what lies within us.', a: 'Ralph Waldo Emerson' },
  { q: 'We know what we are, but know not what we may be.', a: 'William Shakespeare' },
  { q: 'The mind is everything. What you think you become.', a: 'Buddha' },
  { q: 'Health is the greatest gift, contentment the greatest wealth, faithfulness the best relationship.', a: 'Buddha' },
  { q: 'Three things cannot be long hidden: the sun, the moon, and the truth.', a: 'Buddha' },
  { q: 'Educate yourself. Agitate. Organise.', a: 'B. R. Ambedkar' },
  { q: 'I measure the progress of a community by the degree of progress which women have achieved.', a: 'B. R. Ambedkar' },
];

function dayOfYear() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  return Math.floor((now - start) / 86400000);
}

export default memo(function QuoteWidget() {
  const { q, a } = QUOTES[dayOfYear() % QUOTES.length];

  return (
    <div className="quote-wrap" aria-label="Quote of the day">
      <span className="quote-mark" aria-hidden>"</span>
      <blockquote className="quote-text">{q}</blockquote>
      <cite className="quote-author">— {a}</cite>
    </div>
  );
});

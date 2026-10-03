import { Link } from '@tanstack/react-router';
import { Card } from '../../components/Card';
import { ScreenHeader } from '../../components/ScreenHeader';
import { COMMUNITY_URL, COMPANY, JITEN_URL, SOURCE_URL } from '../../config';
import styles from './AboutPage.module.css';

const CC_BY_SA = 'https://creativecommons.org/licenses/by-sa/4.0/';

export function AboutPage() {
  return (
    <>
      <ScreenHeader title="About" />
      <div className={styles.sections}>
        <Card>
          <p>
            WaniStats shows when you&apos;ll level up, how heavy your reviews will get, when
            you&apos;ll reach your goal level and how much real Japanese your kanji cover. It reads
            your data from the WaniKani API with your own token and keeps everything in this
            browser. It&apos;s free, with no ads.
          </p>
          <p>
            WaniStats is a free passion project by the founder of {COMPANY}, built for fellow
            WaniKani learners.
          </p>
          <div className={styles.links}>
            <a href={`${SOURCE_URL}/issues/new`}>Report a bug or suggest a feature</a>
            <a href={SOURCE_URL}>Source on GitHub</a>
            {COMMUNITY_URL && <a href={COMMUNITY_URL}>Community thread</a>}
          </div>
        </Card>
        <Card title="Data sources">
          <p>
            WaniKani content, including subjects, meanings, readings and radical images, belongs to
            Tofugu, LLC. WaniStats is not affiliated with or endorsed by WaniKani or Tofugu, LLC.
          </p>
          <ul className={styles.list}>
            <li>
              Frequency data from <a href={JITEN_URL}>Jiten (jiten.moe)</a>,{' '}
              <a href={CC_BY_SA}>CC BY-SA 4.0</a>.
            </li>
            <li>
              Kanji data from{' '}
              <a href="https://www.edrdg.org/wiki/index.php/KANJIDIC_Project">KANJIDIC2</a>,
              Electronic Dictionary Research and Development Group,{' '}
              <a href="https://www.edrdg.org/edrdg/licence.html">CC BY-SA 4.0</a>.
            </li>
            <li>
              JLPT levels from{' '}
              <a href="https://www.tanos.co.uk/jlpt/">Jonathan Waller&apos;s JLPT lists</a>,{' '}
              <a href="https://www.tanos.co.uk/jlpt/sharing/">CC BY</a>, via{' '}
              <a href="https://github.com/davidluzgouveia/kanji-data">davidluzgouveia/kanji-data</a>
              , <a href="https://github.com/davidluzgouveia/kanji-data/blob/master/LICENSE">MIT</a>.
            </li>
          </ul>
          <p>
            Data packs are shared under CC BY-SA 4.0.{' '}
            <a href="/data/LICENSE-DATA.md">Data licences and sources</a>
          </p>
          <div className={styles.links}>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
        </Card>
      </div>
    </>
  );
}

import { useLang } from '../i18n'
import { BADGE_THRESHOLDS, LEVELS, type BadgeFamily } from '../lib/progress'
import { Header, Icon } from '../components/ui'

export function HowItWorks({ back }: { back: () => void }) {
  const lang = useLang()
  const tr = (fr: string, en: string) => (lang === 'en' ? en : fr)
  const tierRows: [string, string][] = [
    [tr('Question palier 1', 'Tier 1 question'), '1'],
    [tr('Question palier 3', 'Tier 3 question'), '3'],
    [tr('Question palier 6', 'Tier 6 question'), '6'],
  ]

  return (
    <main className="screen how-screen">
      <Header title={tr('Comment ça marche', 'How it works')} back={back} />
      <section className="how-intro glass">
        <span aria-hidden="true">
          <Icon name="book" size={26} />
        </span>
        <div>
          <h1>{tr('Le jeu de l’entraide', 'The helping game')}</h1>
          <p>
            {tr(
              'Cinq règles simples, des points réels et des badges pour reconnaître ceux qui font avancer la communauté.',
              'Five simple rules, real points and badges that recognise the people moving the community forward.',
            )}
          </p>
        </div>
      </section>

      <section className="how-section">
        <h2>{tr('Les 5 règles', 'The 5 rules')}</h2>
        <ol className="rules-list">
          <li>
            <b>{tr('Aide quelqu’un', 'Help someone')}</b>
            <span>
              {tr(
                'Réponds à une question. Quand l’auteur valide ta réponse, tu reçois le palier mis de côté.',
                'Answer a question. When the author validates your answer, you receive the held points.',
              )}
            </span>
          </li>
          <li>
            <b>{tr('Partage un projet', 'Share a project')}</b>
            <span>
              {tr(
                'Publie un projet open source : +3 points. Chaque « Ça m’a servi » reçu rapporte +1 point.',
                'Publish an open-source project: +3 points. Every “This helped me” received earns +1 point.',
              )}
            </span>
          </li>
          <li>
            <b>{tr('Pose une question', 'Ask a question')}</b>
            <span>
              {tr(
                'Choisis un palier de 1, 3 ou 6 points. Les points sont mis de côté puis donnés à la réponse validée, ou remboursés après 7 jours sans validation.',
                'Choose a 1, 3 or 6 point tier. Points are held, then given to the validated answer, or refunded after 7 days without a validation.',
              )}
            </span>
          </li>
          <li>
            <b>{tr('Dis merci', 'Say thanks')}</b>
            <span>
              {tr(
                'Clique sur « Ça m’a servi » quand un projet t’aide vraiment. L’auteur gagne +1 point, une fois par personne et par projet.',
                'Click “This helped me” when a project truly helps you. The author earns +1 point, once per person and per project.',
              )}
            </span>
          </li>
          <li>
            <b>{tr('Reviens chaque semaine', 'Come back every week')}</b>
            <span>
              {tr(
                'Une action utile par semaine entretient ta série, ta quête et le défi collectif.',
                'One useful action per week keeps your streak, quest and the collective challenge alive.',
              )}
            </span>
          </li>
        </ol>
      </section>

      <section className="how-section">
        <h2>{tr('Gagner et dépenser', 'Earn and spend')}</h2>
        <div className="how-tables">
          <div className="how-table-card">
            <h3>{tr('Gagner des points', 'Earn points')}</h3>
            <table>
              <tbody>
                <tr>
                  <td>{tr('Inscription', 'Sign-up')}</td>
                  <td>+5</td>
                </tr>
                <tr>
                  <td>{tr('Réponse validée', 'Validated answer')}</td>
                  <td>+1, +3 {tr('ou', 'or')} +6</td>
                </tr>
                <tr>
                  <td>{tr('Projet publié', 'Project published')}</td>
                  <td>+3</td>
                </tr>
                <tr>
                  <td>{tr('« Ça m’a servi » reçu', '“This helped me” received')}</td>
                  <td>+1</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="how-table-card">
            <h3>{tr('Dépenser des points', 'Spend points')}</h3>
            <table>
              <tbody>
                {tierRows.map(([label, value]) => (
                  <tr key={label}>
                    <td>{label}</td>
                    <td>−{value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <small>
              {tr(
                'La question gratuite de la semaine couvre le palier 1. Un projet n’utilise jamais de points.',
                'The weekly free question covers tier 1. A project never spends points.',
              )}
            </small>
          </div>
        </div>
      </section>

      <section className="how-section">
        <h2>{tr('Les paliers 1, 3 et 6', 'Tiers 1, 3 and 6')}</h2>
        <p>
          {tr(
            'Le palier est le montant que tu mets en jeu. Plus la question est difficile, plus la réponse peut rapporter. Une seule réponse est validée par question, et la question expire après 7 jours.',
            'The tier is the amount you put at stake. The harder the question, the more an answer can earn. Only one answer is validated per question, and the question expires after 7 days.',
          )}
        </p>
      </section>

      <section className="how-section">
        <h2>{tr('Les niveaux', 'Levels')}</h2>
        <ol className="level-list">
          {LEVELS.map((level) => (
            <li key={level.min}>
              <b>{lang === 'en' ? level.nameEn : level.name}</b>
              <span>
                {level.min} {tr('points gagnés', 'points earned')}
              </span>
            </li>
          ))}
        </ol>
        <p>
          {tr(
            'Ton niveau suit ton total gagné, pas ton solde. Il ne redescend donc jamais.',
            'Your level follows your total earned, not your balance. It therefore never goes down.',
          )}
        </p>
      </section>

      <section className="how-section">
        <h2>{tr('La série et les jokers', 'Streak and jokers')}</h2>
        <p>
          {tr(
            'Les semaines vont du lundi au lundi en UTC. Une semaine est active dès que tu publies une réponse, qu’une réponse est validée par l’auteur de la question, que tu publies un projet ou que tu dis « Ça m’a servi ». Une simple connexion ne compte pas.',
            'Weeks run Monday to Monday in UTC. A week is active as soon as you publish an answer, an answer is validated by the question author, you publish a project, or you mark a project as helpful. Simply logging in does not count.',
          )}
        </p>
        <p>
          {tr(
            'Un joker pardonne une semaine manquée, à condition qu’elle soit encadrée par deux semaines actives et qu’aucun autre joker ne soit utilisé à moins de quatre semaines. Les semaines pardonnées comptent dans la série.',
            'A joker forgives one missed week, provided it is surrounded by two active weeks and no other joker was used within four weeks. Forgiven weeks count towards the streak.',
          )}
        </p>
      </section>

      <section className="how-section">
        <h2>{tr('Les badges', 'Badges')}</h2>
        <table className="badge-table">
          <thead>
            <tr>
              <th>{tr('Famille', 'Family')}</th>
              <th>Bronze</th>
              <th>{tr('Argent', 'Silver')}</th>
              <th>{tr('Or', 'Gold')}</th>
            </tr>
          </thead>
          <tbody>
            {(
              [
                ['help', tr('Entraide', 'Helping')],
                ['share', tr('Partage', 'Sharing')],
                ['useful', tr('Utilité', 'Usefulness')],
                ['streak', tr('Série', 'Streak')],
              ] as [BadgeFamily, string][]
            ).map(([family, label]) => (
              <tr key={family}>
                <td>{label}</td>
                {BADGE_THRESHOLDS[family].map((threshold) => (
                  <td key={threshold}>{threshold}</td>
                ))}
              </tr>
            ))}
            <tr>
              <td>{tr('Spécialités', 'Specialties')}</td>
              {BADGE_THRESHOLDS.specialty.map((threshold) => (
                <td key={threshold}>{threshold}</td>
              ))}
            </tr>
          </tbody>
        </table>
        <p>
          {tr(
            'Entraide = réponses validées. Partage = projets publiés. Utilité = « Ça m’a servi » reçus. Série = semaines consécutives. Spécialités : jusqu’à trois technologies, avec le titre « Expert <techno> ».',
            'Helping = validated answers. Sharing = published projects. Usefulness = “This helped me” received. Streak = consecutive weeks. Specialties: up to three technologies, with the “Expert <technology>” title.',
          )}
        </p>
        <p>
          {tr(
            'Badges Communauté : « Première réponse » pour ta première réponse, « Nouvelle voix » pour une réponse à une question débutant, « Bienveillant » pour trois réponses à des questions débutant.',
            'Community badges: “First answer” for your first answer, “New voice” for an answer to a beginner question, “Kind” for three answers to beginner questions.',
          )}
        </p>
      </section>

      <section className="how-section">
        <h2>{tr('Quête et défi', 'Quest and challenge')}</h2>
        <p>
          {tr(
            'Chaque semaine, trois missions : répondre à une question débutant, publier un projet et dire « Ça m’a servi ». Le défi collectif est atteint quand la communauté résout 10 questions dans la semaine. Si tu as été actif, tu débloques le badge « Défi de la semaine ».',
            'Each week, three missions: answer a beginner question, publish a project and mark a project as helpful. The collective challenge is reached when the community solves 10 questions in the week. If you were active, you unlock the “Challenge of the week” badge.',
          )}
        </p>
        <button className="secondary" type="button" onClick={back}>
          {tr('Retour au profil', 'Back to profile')}
        </button>
      </section>
    </main>
  )
}

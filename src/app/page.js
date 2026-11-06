const services = [
  {
    icon: "🩺",
    title: "Doctor Channeling",
    description: "Find trusted specialists and book an appointment at a time that suits you.",
  },
  {
    icon: "💻",
    title: "Online Consultations",
    description: "Connect with healthcare professionals from the comfort of your home.",
  },
  {
    icon: "📋",
    title: "Appointment Management",
    description: "Keep your appointments organized and access your booking details easily.",
  },
  {
    icon: "❤️",
    title: "Patient Care",
    description: "A simpler way to stay connected with the healthcare you need.",
  },
];

const steps = [
  ["01", "Find a doctor", "Search for a specialist based on your healthcare needs."],
  ["02", "Choose a time", "Select a convenient date and available appointment slot."],
  ["03", "Get care", "Attend your appointment in person or online."],
];

export default function Home() {
  return (
    <main>
      <header className="site-header">
        <nav className="navbar container">
          <a className="brand" href="#" aria-label="MediChannel home">
            <span className="brand-mark">M+</span>
            <span>Medi<span>Channel</span></span>
          </a>

          <div className="nav-links">
            <a href="#home">Home</a>
            <a href="#services">Services</a>
            <a href="#how-it-works">How it works</a>
            <a href="#about">About us</a>
          </div>

          <details className="mobile-menu">
            <summary aria-label="Open navigation menu">
              <span></span>
              <span></span>
              <span></span>
            </summary>

            <div className="mobile-menu-panel">
              <a href="#home">Home</a>
              <a href="#services">Services</a>
              <a href="#how-it-works">How it works</a>
              <a href="#about">About us</a>
              <div className="mobile-menu-divider"></div>
              <a href="/login">Log in</a>
              <a className="mobile-menu-cta" href="/register">Get started</a>
            </div>
          </details>

          <div className="nav-actions">
            <a className="login-link" href="/login">Log in</a>
            <a className="button button-small" href="/register">Get started</a>
          </div>
        </nav>
      </header>

      <section className="hero" id="home">
        <div className="container hero-grid">
          <div className="hero-content">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              YOUR HEALTH, OUR PRIORITY
            </span>

            <h1>
              Better healthcare,
              <span> made simpler.</span>
            </h1>

            <p className="hero-description">
              Your health journey deserves a simpler experience. Discover
              trusted healthcare professionals and manage your appointments
              with MediChannel.
            </p>

            <div className="hero-actions">
              <a className="button" href="/appointments">
                Book an appointment <span aria-hidden="true">→</span>
              </a>
              <a className="text-link" href="#how-it-works">
                How it works <span aria-hidden="true">↗</span>
              </a>
            </div>

            <div className="hero-trust">
              <div className="trust-avatars" aria-hidden="true">
                <span>👩🏻‍⚕️</span>
                <span>👨🏽‍⚕️</span>
                <span>👩🏽‍⚕️</span>
              </div>
              <p><strong>Care made convenient</strong><br />For patients and healthcare professionals</p>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-photo">
              <div className="photo-label">
                <span className="photo-label-icon">✚</span>
                <span><strong>Care that connects</strong><small>Healthcare, made accessible</small></span>
              </div>
            </div>
            <div className="floating-card">
              <span className="floating-icon">✓</span>
              <span><strong>Your care, organized</strong><small>Appointments in one place</small></span>
            </div>
            <div className="decor decor-one" />
            <div className="decor decor-two" />
          </div>
        </div>
      </section>

      <section className="quick-info">
        <div className="container info-grid">
          <div><span className="info-icon">✚</span><span><strong>Patient-focused</strong><small>Designed around your needs</small></span></div>
          <div><span className="info-icon">⌚</span><span><strong>Save your time</strong><small>Manage appointments easily</small></span></div>
          <div><span className="info-icon">♡</span><span><strong>Connected care</strong><small>In-person and online options</small></span></div>
        </div>
      </section>

      <section className="section services-section" id="services">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">WHAT WE OFFER</span>
            <h2>Healthcare that works <span>for you.</span></h2>
            <p>Everything you need to make your healthcare experience more convenient.</p>
          </div>

          <div className="services-grid">
            {services.map((service) => (
              <article className="service-card" key={service.title}>
                <div className="service-icon">{service.icon}</div>
                <h3>{service.title}</h3>
                <p>{service.description}</p>
                <a href="/services">Learn more <span aria-hidden="true">→</span></a>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section steps-section" id="how-it-works">
        <div className="container steps-layout">
          <div className="steps-intro">
            <span className="eyebrow">A SIMPLE PROCESS</span>
            <h2>Getting care is just <span>three steps away.</span></h2>
            <p>We make it easier to find the care you need, without the unnecessary complications.</p>
            <a className="button" href="/register">Start your journey <span aria-hidden="true">→</span></a>
          </div>

          <div className="steps-list">
            {steps.map(([number, title, description]) => (
              <article className="step-item" key={number}>
                <span className="step-number">{number}</span>
                <div><h3>{title}</h3><p>{description}</p></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-section" id="about">
        <div className="container cta-content">
          <div>
            <span className="eyebrow">YOUR HEALTH MATTERS</span>
            <h2>Take the next step towards better healthcare.</h2>
            <p>Make managing your healthcare appointments a little easier with MediChannel.</p>
          </div>
          <a className="button button-white" href="/register">Get started <span aria-hidden="true">→</span></a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="container footer-main">
          <div className="footer-brand">
            <a className="brand brand-light" href="#">
              <span className="brand-mark">M+</span>
              <span>Medi<span>Channel</span></span>
            </a>
            <p>Making healthcare more accessible, convenient, and connected.</p>
          </div>

          <div className="footer-column">
            <h3>Explore</h3>
            <a href="#home">Home</a>
            <a href="#services">Services</a>
            <a href="#how-it-works">How it works</a>
          </div>

          <div className="footer-column">
            <h3>Account</h3>
            <a href="/login">Log in</a>
            <a href="/register">Create an account</a>
            <a href="/appointments">Appointments</a>
          </div>

          <div className="footer-column">
            <h3>Contact</h3>
            <a href="mailto:support@medichannel.example">Email support</a>
            <span>We're here to help</span>
          </div>
        </div>

        <div className="container footer-bottom">
          <p>© {2026} MediChannel. All rights reserved.</p>
          <p>Designed with care.</p>
        </div>
      </footer>
    </main>
  );
}

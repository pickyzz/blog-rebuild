import { GradientText, HeroAvatar, HeroSocial, Section } from '@/components';

const Hero = () => (
  <Section>
    <HeroAvatar
      title={
        <>
          Hi there, I'm <GradientText>Pickyzz</GradientText> 👋
        </>
      }
      description={
        <>Self-taught front-end developer. Never stop learning about code.</>
      }
      avatar={
        <img
          className="h-64 w-64"
          src="/assets/images/avatar.png"
          alt="Avatar image"
          loading="lazy"
        />
      }
      socialButtons={
        // icon via https://icon-sets.iconify.design/fa/github-square/
        <>
          <a href="https://twitter.com/p1ckyzz" target="_blank" rel="noopener noreferrer">
            <HeroSocial
              src="/assets/images/twitter-icon.svg"
              alt="Twitter icon"
            />
          </a>
          <a href="https://facebook.com/iiipik" target="_blank" rel="noopener noreferrer">
            <HeroSocial
              src="/assets/images/facebook-icon.svg"
              alt="Facebook icon"
            />
          </a>
          <a href="https://github.com/pickyzz" target="_blank" rel="noopener noreferrer">
            <HeroSocial
              src="/assets/images/github-icon.svg"
              alt="Github icon"
            />
          </a>
        </>
      }
    />
  </Section>
);

export { Hero };

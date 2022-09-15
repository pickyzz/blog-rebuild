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
        <>
          <a href="https://twitter.com/p1ckyzz" target="_blank">
            <HeroSocial
              src="/assets/images/twitter-icon.png"
              alt="Twitter icon"
            />
          </a>
          <a href="https://facebook.com/iiipik" target="_blank">
            <HeroSocial
              src="/assets/images/facebook-icon.png"
              alt="Facebook icon"
            />
          </a>
        </>
      }
    />
  </Section>
);

export { Hero };

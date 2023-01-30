type IHeroSocialProps = {
  src: string;
  alt: string;
};

const HeroSocial = (props: IHeroSocialProps) => (
  <img
    className="mr-1 h-10 w-10 hover:translate-y-1"
    src={props.src}
    alt={props.alt}
    loading="lazy"
  />
);

export { HeroSocial };

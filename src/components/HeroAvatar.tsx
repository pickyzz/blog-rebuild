import type { ReactNode } from 'react';

type IHeroAvatarProps = {
  title: ReactNode;
  description: ReactNode;
  avatar: ReactNode;
  socialButtons: ReactNode;
};

const HeroAvatar = (props: IHeroAvatarProps) => (
  <div className="flex flex-col items-center md:flex-row md:justify-between md:gap-x-24">
    <div>
      <h1 className="text-3xl font-bold">{props.title}</h1>

      <p className="mt-6 text-xl leading-9">{props.description}</p>

      <div className="mt-6 flex gap-1">{props.socialButtons}</div>
    </div>
    <div
      className="tooltip tooltip-left tooltip-info hidden md:flex"
      data-tip="Hello~"
    >
      <div className="shrink-0">{props.avatar}</div>
    </div>
  </div>
);

export { HeroAvatar };

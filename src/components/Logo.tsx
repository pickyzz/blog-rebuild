import type { ReactNode } from 'react';

type ILogoProps = {
  icon: ReactNode;
  name: string;
};

const Logo = (props: ILogoProps) => (
  <div className="flex items-center bg-gradient-to-br from-sky-500 to-yellow-400 bg-clip-text text-xl font-bold text-transparent">
    {props.icon}

    {props.name}
  </div>
);

export { Logo };

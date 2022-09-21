import { GradientText, Section } from '@/components';

const AboutPage = () => (
  <Section>
    <p className="text-center font-bold text-[2.2em] mb-8 -mt-2">About me</p>

    <div className="grid grid-cols-2 gap-2 my-4">
      <img
        className="text-center h-auto w-[70%] rounded-full"
        src="/assets/images/profile.jpg"
        alt="Avatar image"
        loading="lazy"
      />
      <div className="">
        <p className="text-3xl font-bold mb-4">
          <GradientText>Parinya T.</GradientText>
        </p>
        <p className="my-1">
          Bachelor’s of Science degree (B. Sc.) KMUTNB, Thailand
        </p>
        <p className="my-1">
          <span className="font-bold">Language</span> : TH, EN
        </p>
        <p className="my-1">
          <span className="font-bold">Date of birth</span> : 30 - 09 - 1993
        </p>
        <p className="my-1">
          <span className="font-bold">E-mail</span> :{' '}
          <a
            href="mailto:contact@pickyzz.dev"
            target="_blank"
            rel="noreferrer"
          >
            contact@pickyzz.dev
          </a>
        </p>
        <p className="my-1">
          <span className="font-bold">Twitter</span> :{' '}
          <a
            href="https://twitter.com/p1ckyzz"
            target="_blank"
            rel="noreferrer"
          >
            @p1ckyzz
          </a>
        </p>
        <p className="my-1">
          <span className="font-bold">Github</span> :{' '}
          <a href="https://github.com/pickyzz" target="_blank" rel="noreferrer">
            github.com/pickyzz
          </a>
        </p>
        <p className="my-1">
          <span className="font-bold">FCC</span> :{' '}
          <a
            href="https://freecodecamp.org/pickyzz"
            target="_blank"
            rel="noreferrer"
          >
            freecodecamp.org/pickyzz
          </a>
        </p>
        <div className="my-4">
          <p className="text-2xl">My skill</p>
          <p className="my-1">
            Lua, HTML, CSS, JavaScript, React, NextJs, Tailwind CSS
          </p>
        </div>
      </div>
    </div>

    <div className="mt-12 flex justify-center ">
      <img
        className="text-center h-auto w-[65%]"
        src="/assets/images/fcc-cert-1.png"
        alt="Avatar image"
        loading="lazy"
      />
    </div>
    <div className="mt-12 flex justify-center ">
      <img
        className="text-center h-auto w-[65%]"
        src="/assets/images/fcc-cert-2.png"
        alt="Avatar image"
        loading="lazy"
      />
    </div>
  </Section>
);

export { AboutPage };

import { ColorTags, GradientText, Project, Section, Tags } from '@/components';

const ProjectList = () => (
  <Section
    title={
      <>
        Recent <GradientText>Projects</GradientText>
      </>
    }
  >
    <div className="flex flex-col gap-6">
      <Project
        name="Svelte-duply"
        description="simple sveltekit template for single page app building."
        link="https://github.com/pickyzz/svelte-duply"
        img={{
          src: '/assets/images/project/svelte_logo.png',
          alt: 'Svelte'
        }}
        category={
          <>
            <Tags color={ColorTags.FUCHSIA}>SvelteJs</Tags>
            <Tags color={ColorTags.SKY}>Tailwind.css</Tags>
            <Tags color={ColorTags.ROSE}>TypeScript</Tags>
            <Tags color={ColorTags.EMERALD}>DaisyUi</Tags>
          </>
        }
      />
      <Project
        name="YakGinRai"
        description="SPA project that random a meal in Thai language. build using Svelte"
        link="https://github.com/pickyzz/yakginrai"
        img={{ src: '/assets/images/project/svelte_logo.png', alt: 'Svelte' }}
        category={
          <>
            <Tags color={ColorTags.FUCHSIA}>SvelteJs</Tags>
            <Tags color={ColorTags.SKY}>Tailwind.css</Tags>
            <Tags color={ColorTags.ROSE}>TypeScript</Tags>
            <Tags color={ColorTags.EMERALD}>DaisyUi</Tags>
          </>
        }
      />
    </div>
  </Section>
);

export { ProjectList };

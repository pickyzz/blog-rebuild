/* eslint-disable react/no-unknown-property */
import { GradientText, Section } from '@/components';

const ContactForm = () => (
  <Section>
    <p className="mb-8 -mt-2 text-center text-[2.2em] font-bold">
      <GradientText>Contact</GradientText>
    </p>
    <div className="flex justify-center">
      <form
        name="contact"
        method="POST"
        netlify-honeypot="bot-field"
        data-netlify="true"
      >
        {/* https://docs.netlify.com/forms/spam-filters/ */}
        <p className="hidden">
          <label>
            Don’t fill this out if you’re human: <input name="bot-field" />
          </label>
        </p>

        <div>
          <p className="text-md mb-2 text-center font-semibold">Name</p>
          <input
            className="input input-bordered input-primary mb-2 w-full max-w-sm"
            type="text"
            name="name"
          />
        </div>
        <div>
          <p className="text-md mb-2 text-center font-semibold">Email</p>
          <input
            className="input input-bordered input-primary mb-2 w-full max-w-sm"
            type="email"
            name="email"
          />
        </div>
        <div>
          <p className="text-md mb-2 text-center font-semibold">Message</p>
          <textarea
            className="input input-bordered input-primary input-lg mb-2 h-[140px] w-full max-w-sm"
            name="message"
          ></textarea>
        </div>
        <div className="text-center">
          <button className="btn btn-success" type="submit">
            Send
          </button>
        </div>
      </form>
    </div>
  </Section>
);

export { ContactForm };

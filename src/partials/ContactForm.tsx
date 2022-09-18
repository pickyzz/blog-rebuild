/* eslint-disable react/no-unknown-property */
import { GradientText, Section } from '@/components';

const ContactForm = () => (
  <Section>
    <p className="text-center font-bold text-[2.2em] mb-8 -mt-2">
      <GradientText>
        Contact
      </GradientText>
    </p>
    <div className='flex justify-center'>
      <form name="contact" method="POST" netlify-honeypot="bot-field" data-netlify="true">
      {/* https://docs.netlify.com/forms/spam-filters/ */}
      <p className="hidden">
        <label>
          Don’t fill this out if you’re human: <input name="bot-field" />
        </label>
      </p>

        <div>
          <p className='text-center text-md font-semibold mb-2'>Name</p>
          <input className='input input-bordered input-primary w-full max-w-sm mb-2' type="text" name="name" />
        </div>
        <div>
          <p className='text-center text-md font-semibold mb-2'>Email</p>
          <input className='input input-bordered input-primary w-full max-w-sm mb-2' type="email" name="email" />
        </div>
        <div>
          <p className='text-center text-md font-semibold mb-2'>Message</p>
            <textarea className='input input-bordered input-primary input-lg h-[140px] w-full max-w-sm mb-2' name="message"></textarea>
        </div>
        <div className='text-center'>
          <button className='btn btn-success' type="submit">Send</button>
        </div>
      </form>
    </div>
  </Section>
);

export { ContactForm };

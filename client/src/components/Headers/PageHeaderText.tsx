interface PageHeaderTextProps {
  title: string;
  subtitle?: string;
}

const PageHeaderText: React.FC<PageHeaderTextProps> = ({ title, subtitle }) => {
  return (
    <div className='my-6'>
      <h1 className='font-bold text-4xl'>{title}</h1>
      <p className='font-bold text-lg'>{subtitle}</p>
    </div>
  );
};

export default PageHeaderText;

import { Button, CardHeader } from 'reactstrap';
import { ChevronDown, ChevronUp } from 'react-feather';
import { HeaderWithIconPropsTypes } from '@/Type/SideBarType';

const HeaderWithIcon = ({ setIsOpen, isOpen, Heading }: HeaderWithIconPropsTypes) => {
  return (
    <CardHeader>
      <h5 className='mb-0'>
        <Button className='btn-link ps-0 d-flex justify-content-between' onClick={() => setIsOpen(!isOpen)} color='transperant'>
          {Heading}
          {isOpen ? <ChevronUp className='m-0' /> : <ChevronDown className='m-0' />}
        </Button>
      </h5>
    </CardHeader>
  );
};

export default HeaderWithIcon;

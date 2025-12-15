import { AssetsImagePath, Javascript, SeeAll } from '@/packages/Constant';
import { MessageDropData } from '@/Data/HeaderData/MessageDropData';
import Image from 'next/image';
import React from 'react';
import { MessageSquare } from 'react-feather';
import { ListGroup, ListGroupItem, Media } from 'reactstrap';

const MessageDrop = () => {
  return (
    <li className='onhover-dropdown'>
      <MessageSquare />
      <ListGroup className='chat-dropdown onhover-show-div'>
        {MessageDropData.map((element, index) => (
          <ListGroupItem key={index}>
            <Media>
              <img className='img-fluid rounded-circle me-3' alt='Message Image' src={`${AssetsImagePath}${element.image}`} />
              <Media body>
                <span>{element.title}</span>
                <p className='f-12 light-font'>{element.description}</p>
              </Media>
              <p className='f-12'>{element.time}</p>
            </Media>
          </ListGroupItem>
        ))}
        <ListGroupItem className='text-center'>
          <a className='f-w-700' href={Javascript}>
            {SeeAll}
          </a>
        </ListGroupItem>
      </ListGroup>
    </li>
  );
};

export default MessageDrop;

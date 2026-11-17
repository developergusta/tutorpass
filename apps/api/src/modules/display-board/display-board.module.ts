import { Module } from '@nestjs/common';
import { DisplayBoardService } from './display-board.service';

@Module({ providers: [DisplayBoardService], exports: [DisplayBoardService] })
export class DisplayBoardModule {}
